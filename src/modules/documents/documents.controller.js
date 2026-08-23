const documentsService = require('./documents.service.js');

async function list(req, res) {
  const result = await documentsService.list(req.user.id, req.query);
  res.json(result);
}

async function listTrash(req, res) {
  const documents = await documentsService.listTrash(req.user.id);
  res.json({ documents });
}

async function listRecent(req, res) {
  const documents = await documentsService.listRecent(req.user.id);
  res.json({ documents });
}

async function search(req, res) {
  const result = await documentsService.list(req.user.id, req.query);
  res.json(result);
}

async function getById(req, res) {
  const document = await documentsService.getById(req.user.id, req.params.id);
  res.json({ document });
}

async function create(req, res) {
  const document = await documentsService.create(req.user.id, req.body);
  res.status(201).json({ document });
}

async function update(req, res) {
  const document = await documentsService.update(req.user.id, req.params.id, req.body);
  res.json({ document });
}

async function duplicate(req, res) {
  const document = await documentsService.duplicate(req.user.id, req.params.id);
  res.status(201).json({ document });
}

async function remove(req, res) {
  await documentsService.remove(req.user.id, req.params.id);
  res.status(204).end();
}

async function restore(req, res) {
  await documentsService.restore(req.user.id, req.params.id);
  res.status(204).end();
}

async function purge(req, res) {
  await documentsService.purge(req.user.id, req.params.id);
  res.status(204).end();
}

module.exports = {
  list,
  listTrash,
  listRecent,
  search,
  getById,
  create,
  update,
  duplicate,
  remove,
  restore,
  purge,
};
