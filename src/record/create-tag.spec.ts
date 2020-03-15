import createTag from './create-tag';

describe('createTag', () => {
  it('creates tag with name equal to input key and number version', () => {
    const newTag = createTag('tag');

    expect(newTag.name).toEqual('tag');
    expect(newTag.version).toEqual(expect.any(Number));
  });
});
