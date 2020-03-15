import { StorageRecordTag } from '../storage';

export default (tagName: string): StorageRecordTag => ({
  name: tagName,
  version: Date.now()
});
