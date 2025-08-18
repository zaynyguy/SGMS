const express = require('express');
const router = express.Router();
const groupsController = require('../controllers/groupsController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');


router.use(authenticateJWT, authorizePermissions(['manage_users']));


router.route('/')
  .get(groupsController.getAllGroups)
  .post(groupsController.createGroup);

router.route('/:id')
  .put(groupsController.updateGroup)
  .delete(groupsController.deleteGroup);

module.exports = router;
