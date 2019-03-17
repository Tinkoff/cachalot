export default class RefreshAheadManager {
  static getName = (): string => 'refresh-ahead';
  get: any = jest.fn();
  set: any = jest.fn();
}
