function buildPagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function buildSort(query, allowedFields = ["createdAt"], defaultField = "createdAt") {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const order = query.order === "asc" ? 1 : -1;

  return { [sortBy]: order };
}

function buildSearch(search, fields = []) {
  if (!search || !search.trim() || !fields.length) return {};

  const s = search.trim();

  return {
    $or: fields.map((field) => ({
      [field]: { $regex: s, $options: "i" },
    })),
  };
}

function buildPaginationMeta(total, page, limit) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = {
  buildPagination,
  buildSort,
  buildSearch,
  buildPaginationMeta,
};