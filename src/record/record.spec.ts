import createRecord from './index';

describe('createRecord', () => {
  it('creates record with default options', () => {
    const record = createRecord('someKey', 'someValue', [{
      name: 'tag1',
      version: 1537166844338
    }]);

    expect(record).toMatchObject({
      key: 'someKey',
      value: 'someValue',
      tags: [{
        name: 'tag1',
        version: 1537166844338
      }],
      permanent: true
    });

    expect(record.expiresIn).toEqual(expect.any(Number));
    expect(record.createdAt).toEqual(expect.any(Number));
  });

  it('creates record with no tags if value is undefined', () => {
    const record = createRecord('someKey', undefined as any, [{
      name: 'tag1',
      version: 1537166844338
    }]);

    expect(record).toMatchObject({
      key: 'someKey',
      value: undefined,
      tags: [],
      permanent: true
    });

    expect(record.expiresIn).toEqual(expect.any(Number));
    expect(record.createdAt).toEqual(expect.any(Number));
  });
});
