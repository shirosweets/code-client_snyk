import { analyzeFolders, createBundleFromFolders } from './analysis';
import emitter from './emitter';
import { startSession, checkSession } from './http';
import * as constants from './constants';
import { getGlobPatterns } from './files';

import { SupportedFiles } from './interfaces/files.interface';
import { AnalysisSeverity } from './interfaces/analysis-options.interface';
import { AnalysisResult } from './interfaces/analysis-result.interface';

export {
  getGlobPatterns,
  analyzeFolders,
  createBundleFromFolders,
  // extendAnalysis,
  startSession,
  checkSession,
  emitter,
  constants,
  AnalysisSeverity,
  AnalysisResult,
  SupportedFiles,
};
