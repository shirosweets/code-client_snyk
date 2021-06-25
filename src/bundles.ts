/* eslint-disable no-await-in-loop */
import chunk from 'lodash.chunk';
import pick from 'lodash.pick';
import omit from 'lodash.omit';

import { BundleFiles, FileInfo } from './interfaces/files.interface';

import { composeFilePayloads, resolveBundleFiles } from './files';

import {
  CreateBundleErrorCodes,
  CheckBundleErrorCodes,
  ExtendBundleErrorCodes,
  createBundle,
  extendBundle,
  checkBundle,
  Result,
  RemoteBundle,
  ConnectionOptions,
} from './http';
import { MAX_PAYLOAD, MAX_UPLOAD_ATTEMPTS } from './constants';
import emitter from './emitter';

type BundleErrorCodes = CreateBundleErrorCodes | CheckBundleErrorCodes | ExtendBundleErrorCodes;

interface PrepareRemoteBundleOptions extends ConnectionOptions {
  files: FileInfo[];
  bundleHash?: string;
  removedFiles?: string[];
  maxPayload?: number;
}

async function* prepareRemoteBundle({
  maxPayload = MAX_PAYLOAD,
  ...options
}: PrepareRemoteBundleOptions): AsyncGenerator<Result<RemoteBundle, BundleErrorCodes>> {
  let response: Result<RemoteBundle, BundleErrorCodes>;
  let { bundleHash } = options;

  const fileChunks = chunk(options.files, maxPayload / 300);
  emitter.createBundleProgress(0, fileChunks.length);
  for (const [i, chunkedFiles] of fileChunks.entries()) {
    const apiParams = {
      ...pick(options, ['baseURL', 'sessionToken', 'source', 'removedFiles']),
      files: chunkedFiles.reduce((d, f) => ({ ...d, [f.bundlePath]: f.hash }), {} as BundleFiles),
    };

    if (!bundleHash) {
      // eslint-disable-next-line no-await-in-loop
      response = await createBundle(apiParams);
    } else {
      // eslint-disable-next-line no-await-in-loop
      response = await extendBundle({ bundleHash, ...apiParams });
    }

    emitter.createBundleProgress(i + 1, fileChunks.length);

    if (response.type === 'error') {
      // TODO: process Error
      yield response;
      break;
    }
    bundleHash = response.value.bundleHash;

    yield response;
  }
}

interface UpdateRemoteBundleOptions extends ConnectionOptions {
  bundleHash: string;
  files: FileInfo[];
  maxPayload?: number;
}

/**
 * Splits files in buckets and upload in parallel
 * @param baseURL
 * @param sessionToken
 * @param remoteBundle
 */
export async function uploadRemoteBundle({
  maxPayload = MAX_PAYLOAD,
  ...options
}: UpdateRemoteBundleOptions): Promise<boolean> {
  let uploadedFiles = 0;
  emitter.uploadBundleProgress(0, options.files.length);

  const apiParams = pick(options, ['baseURL', 'sessionToken', 'source', 'bundleHash']);

  const uploadFileChunks = async (bucketFiles: FileInfo[]): Promise<boolean> => {
    const resp = await extendBundle({
      ...apiParams,
      files: bucketFiles.reduce((d, f) => ({ ...d, [f.bundlePath]: pick(f, ['hash', 'content']) }), {}),
    });

    if (resp.type !== 'error') {
      uploadedFiles += bucketFiles.length;
      emitter.uploadBundleProgress(uploadedFiles, options.files.length);
      return true;
    }

    return false;
  };

  const tasks = [];
  for (const bucketFiles of composeFilePayloads(options.files, maxPayload)) {
    tasks.push(uploadFileChunks(bucketFiles));
  }

  if (tasks.length) {
    return (await Promise.all(tasks)).some(r => !!r);
  }
  return true;
}

interface FullfillRemoteBundleOptions extends ConnectionOptions {
  baseDir: string;
  remoteBundle: RemoteBundle;
  maxPayload?: number;
  maxAttempts?: number;
}

async function fullfillRemoteBundle(options: FullfillRemoteBundleOptions): Promise<RemoteBundle> {
  // Fulfill remote bundle by uploading only missing files (splitted in chunks)
  // Check remove bundle to make sure no missing files left
  let attempts = 0;
  let { remoteBundle } = options;
  const connectionOptions = pick(options, ['baseURL', 'sessionToken', 'source']);

  while (remoteBundle.missingFiles.length && attempts < (options.maxAttempts || MAX_UPLOAD_ATTEMPTS)) {
    const missingFiles = await resolveBundleFiles(options.baseDir, remoteBundle.missingFiles);
    const isUploaded = await uploadRemoteBundle({
      ...connectionOptions,
      bundleHash: remoteBundle.bundleHash,
      files: missingFiles,
    });
    if (!isUploaded) {
      throw new Error('Failed to upload some files');
    }

    const bundleResponse = await checkBundle({ ...connectionOptions, bundleHash: remoteBundle.bundleHash });
    if (bundleResponse.type === 'error') {
      throw new Error('Failed to get remote bundle');
    }
    // eslint-disable-next-line no-param-reassign
    remoteBundle = bundleResponse.value;
    attempts += 1;
  }
  return remoteBundle;
}

interface RemoteBundleFactoryOptions extends PrepareRemoteBundleOptions {
  baseDir: string;
}

export async function remoteBundleFactory(options: RemoteBundleFactoryOptions): Promise<RemoteBundle | null> {
  let remoteBundle: RemoteBundle | null = null;
  const baseOptions = pick(options, ['baseURL', 'sessionToken', 'source', 'baseDir']);

  const bundleFactory = prepareRemoteBundle(omit(options, ['baseDir']));
  for await (const response of bundleFactory) {
    if (response.type === 'error') {
      throw response.error;
    }

    remoteBundle = await fullfillRemoteBundle({ ...baseOptions, remoteBundle: response.value });
    if (remoteBundle.missingFiles.length) {
      throw new Error(`Failed to upload # files: ${remoteBundle.missingFiles.length}`);
    }
  }

  return remoteBundle;
}
