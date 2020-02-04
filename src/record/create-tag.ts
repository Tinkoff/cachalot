import { StorageRecordTag } from '../storage';

export default (tagName: string, version?: number): StorageRecordTag => ({
  name: tagName,
  version: version ?? Date.now()
});
