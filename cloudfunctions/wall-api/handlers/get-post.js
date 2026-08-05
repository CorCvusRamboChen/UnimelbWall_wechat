const { parseId } = require("../lib/validators");
const { detailPost } = require("../lib/serializers");

module.exports = async function getPost(params, context) {
  const id = parseId(params.id);
  const post = await context.repository.getPost(id);

  return {
    ok: true,
    data: detailPost(post)
  };
};
