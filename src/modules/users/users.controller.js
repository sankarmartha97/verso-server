const pool = require('../../infra/postgres/pool.js');
const UserRepository = require('./user.repository.js');
const { toSafeUser } = UserRepository;
const { NotFoundError } = require('../../common/errors.js');

const userRepository = new UserRepository(pool);

async function getMe(req, res) {
  const user = await userRepository.findById(req.user.id);
  if (!user) throw new NotFoundError('User not found');
  res.json({ user: toSafeUser(user) });
}

module.exports = { getMe };
