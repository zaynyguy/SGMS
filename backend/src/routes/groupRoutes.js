const express = require('express');
const router = express.Router();
const groupsController = require('../controllers/groupsController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

// Apply authentication and authorization middleware for all routes
router.use(authenticateJWT, authorizePermissions(['manage_users']));

// GET all groups / CREATE a new group
router.route('/')
  .get(groupsController.getAllGroups)
  .post(groupsController.createGroup);

// UPDATE / DELETE a group by ID
router.route('/:id')
  .put(groupsController.updateGroup)
  .delete(groupsController.deleteGroup);

module.exports = router;
