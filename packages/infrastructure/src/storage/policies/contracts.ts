import { IBinaryReference } from '../contracts';

export interface IStoragePolicy {
  apply(reference: IBinaryReference): Promise<IBinaryReference>;
}

export interface IRetentionPolicy extends IStoragePolicy {
  calculateExpirationDate(reference: IBinaryReference): Date | null;
}

export interface IDeletionPolicy extends IStoragePolicy {
  shouldHardDelete(reference: IBinaryReference): boolean;
}

export interface IEncryptionPolicy extends IStoragePolicy {
  requiresEncryption(reference: IBinaryReference): boolean;
  getEncryptionKeyId(reference: IBinaryReference): string | null;
}

export interface ICompressionPolicy extends IStoragePolicy {
  shouldCompress(reference: IBinaryReference): boolean;
}

export interface IVersionPolicy extends IStoragePolicy {
  shouldVersion(reference: IBinaryReference): boolean;
}
