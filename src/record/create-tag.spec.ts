import createTag from './create-tag';

describe('createTag', () => {
  it('creates tag with name equal to input key and number version', () => {
    const newTag = createTag('tag');

    expect(newTag.name).toEqual('tag');
    expect(newTag.version).toEqual(expect.any(Number));
  });

  it('creates tag with name equal to input key and specified version', () => {
    const newTag = createTag('tag', 2);

    expect(newTag.name).toEqual('tag');
    expect(newTag.version).toEqual(2);
  });
});
