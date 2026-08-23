const foldersService = require('./folders.service.js');

async function list(req, res) {
  const folders = await foldersService.list(req.user.id);
  res.json({ folders });
}

async function create(req, res) {
  const folder = await foldersService.create(req.user.id, req.body);
  res.status(201).json({ folder });
}

async function update(req, res) {
  const folder = await foldersService.update(req.user.id, req.params.id, req.body);
  res.json({ folder });
}

async function remove(req, res) {
  await foldersService.remove(req.user.id, req.params.id);
  res.status(204).end();
}

module.exports = { list, create, update, remove };
