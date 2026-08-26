export type ErrorType = 
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'PASSWORD_PROTECTED'
  | 'CORRUPTED'
  | 'NETWORK_INTERRUPTION'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ProcessingError {
  id: string;
  type: ErrorType;
  title: string;
  description: string;
  suggestion: string;
}

export const MOCK_ERRORS: Record<ErrorType, ProcessingError> = {
  UNSUPPORTED_FORMAT: {
    id: 'err_unsupported',
    type: 'UNSUPPORTED_FORMAT',
    title: 'Unsupported File Format',
    description: 'We currently only support PDF, DOCX, PPTX, and standard image/audio formats.',
    suggestion: 'Please convert your file to a supported format and try again.',
  },
  FILE_TOO_LARGE: {
    id: 'err_too_large',
    type: 'FILE_TOO_LARGE',
    title: 'File Too Large',
    description: 'The uploaded document exceeds the maximum size limit of 100MB.',
    suggestion: 'Try compressing the file or splitting it into smaller parts.',
  },
  PASSWORD_PROTECTED: {
    id: 'err_password',
    type: 'PASSWORD_PROTECTED',
    title: 'Password Protected',
    description: 'The document is encrypted and cannot be processed by our extraction engine.',
    suggestion: 'Remove the password protection and re-upload the file.',
  },
  CORRUPTED: {
    id: 'err_corrupt',
    type: 'CORRUPTED',
    title: 'File Corrupted',
    description: 'We were unable to read the contents of this file. It may be corrupted or incomplete.',
    suggestion: 'Check if the file opens correctly on your device, then re-upload.',
  },
  NETWORK_INTERRUPTION: {
    id: 'err_network',
    type: 'NETWORK_INTERRUPTION',
    title: 'Upload Interrupted',
    description: 'Your connection was lost during the upload process.',
    suggestion: 'Check your internet connection and retry the upload.',
  },
  TIMEOUT: {
    id: 'err_timeout',
    type: 'TIMEOUT',
    title: 'Processing Timeout',
    description: 'The document took too long to process and the operation timed out.',
    suggestion: 'This can happen with extremely complex documents. Try again later.',
  },
  UNKNOWN: {
    id: 'err_unknown',
    type: 'UNKNOWN',
    title: 'Processing Error',
    description: 'An unexpected error occurred while processing your document.',
    suggestion: 'Please try again. If the problem persists, contact support.',
  }
};
