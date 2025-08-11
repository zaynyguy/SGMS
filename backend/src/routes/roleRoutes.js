const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.use(authenticateJWT, authorizePermissions(['manage_roles']));

router.route('/')
  .get(roleController.getAllRoles)
  .post(roleController.createRole);

router.route('/:id')
  .put(roleController.updateRole)
  .delete(roleController.deleteRole);

module.exports = router;
