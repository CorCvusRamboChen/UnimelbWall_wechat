module.exports = async function listCategories(params, context) {
  const categories = await context.repository.listCategories();

  return {
    ok: true,
    data: {
      items: categories.map((category) => ({
        id: category._id,
        name: category.name || "未分类"
      }))
    }
  };
};
