// src/pages/ActivitiesPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  ClipboardList, Plus, Edit, Trash2, Loader, AlertCircle, Save, X, FileText
} from 'lucide-react';
import { fetchActivitiesByTask, createActivity, updateActivity, deleteActivity } from '../api/activities';
import { fetchTasksByGoal } from '../api/tasks';
import { submitReport } from '../api/reports';
import AuthContext from '../context/AuthContext';

/**
 * ActivitiesPage
 *
 * - Displays tasks selector, activity cards
 * - Shows Submit button on each activity card (opens report modal)
 * - Edit/Delete remain for managers (manage_activities)
 * - Status badge now supports Completed, In Progress, Overdue, Todo
 *
 * Assumptions:
 * - fetchActivitiesByTask(taskId) returns activities already scoped to the current user (server-side filtering by group)
 * - currentUser.permissions is an array of permission keys (e.g. ['view_reports', 'manage_activities'])
 */

export default function ActivitiesPage({ goalId }) {
  const { currentUser } = useContext(AuthContext);

  // Data
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [activities, setActivities] = useState([]);

  // loading / error states
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);
  const [error, setError] = useState('');

  // toast
  const [toast, setToast] = useState({ message: '', type: '', visible: false });

  // CRUD modals for activities
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState(null);

  // Submit report modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [activityForReport, setActivityForReport] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Permissions
  const hasManagePermission = currentUser?.permissions?.includes('manage_activities');
  const canSubmitReport = currentUser?.permissions?.includes('view_reports');

  // Helper: show toast
  const showToast = (message, type = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast({ message: '', type: '', visible: false }), 3000);
  };

  // Load tasks for the goal
  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    setError('');
    try {
      const fetchedTasks = await fetchTasksByGoal(goalId);
      setTasks(fetchedTasks || []);
      if (fetchedTasks && fetchedTasks.length > 0) setSelectedTaskId(fetchedTasks[0].id);
    } catch (err) {
      const msg = err?.message || 'Failed to load tasks';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoadingTasks(false);
    }
  }, [goalId]);

  // Load activities for the selected task
  const loadActivities = useCallback(async () => {
    if (!selectedTaskId) {
      setActivities([]);
      return;
    }
    setIsLoadingActivities(true);
    setError('');
    try {
      const data = await fetchActivitiesByTask(selectedTaskId);
      setActivities(data || []);
    } catch (err) {
      const msg = err?.message || 'Failed to load activities';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoadingActivities(false);
    }
  }, [selectedTaskId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { loadActivities(); }, [loadActivities]);

  // --- Activity CRUD handlers (unchanged behavior) ---
// Create activity — pass taskId only
const handleCreateActivity = async () => {
  try {
    const { taskId, goalId } = modal.data || {};
    if (!taskId) throw new Error('Missing taskId for activity creation');
    // Build payload exactly as backend expects:
    const payload = {
      title: formData.title || '',
      description: formData.description || null,
      dueDate: formData.dueDate || null,
      weight: Number(formData.weight) || 0,
      targetMetric: formData.targetMetric || {}
    };
    await createActivity(taskId, payload);
    setModal({ isOpen: false, type: null, data: null });
    setFormData({});
    setSuccess('Activity created successfully!');
    setTimeout(() => setSuccess(null), 3000);
    await loadActivities(goalId, taskId);
    await loadTasks(goalId);
    await loadGoals();
  } catch (err) {
    console.error('Error creating activity:', err);
    setError(err?.message || 'Failed to create activity.');
  }
};

// Update activity — pass taskId and activityId
const handleUpdateActivity = async () => {
  try {
    const { taskId, goalId, id: activityId } = modal.data || {};
    if (!taskId || !activityId) throw new Error('Missing ids for updating activity');
    const payload = {
      title: formData.title ?? undefined,
      description: formData.description ?? undefined,
      dueDate: formData.dueDate ?? undefined,
      weight: formData.weight !== undefined ? Number(formData.weight) : undefined,
      targetMetric: formData.targetMetric !== undefined ? formData.targetMetric : undefined,
      isDone: typeof formData.isDone === 'boolean' ? formData.isDone : undefined
    };
    // remove undefined keys
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    await updateActivity(taskId, activityId, payload);
    setModal({ isOpen: false, type: null, data: null });
    setFormData({});
    setSuccess('Activity updated successfully!');
    setTimeout(() => setSuccess(null), 3000);
    await loadActivities(goalId, taskId);
    await loadTasks(goalId);
    await loadGoals();
  } catch (err) {
    console.error('Error updating activity:', err);
    setError(err?.message || 'Failed to update activity.');
  }
};


  const handleDeleteActivity = async () => {
    if (!selectedTaskId || !activityToDelete) return;
    setIsSubmittingActivity(true);
    try {
      await deleteActivity(selectedTaskId, activityToDelete.id);
      setActivities(prev => prev.filter(a => a.id !== activityToDelete.id));
      setShowDeleteModal(false);
      setActivityToDelete(null);
      showToast('Activity deleted', 'success');
    } catch (err) {
      const msg = err?.message || 'Failed to delete activity';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  // --- Submit Report flow ---
  // Open the submit modal for a specific activity
  const openSubmitFor = (activity) => {
    setActivityForReport(activity);
    setSubmitError(null);
    setShowReportModal(true);
  };

  // Called by ReportSubmitModal with (reportData, files)
  const handleSubmitReport = async (reportData, files = []) => {
    if (!activityForReport) return;
    setIsSubmittingReport(true);
    setSubmitError(null);
    try {
      await submitReport(activityForReport.id, reportData, files);
      setShowReportModal(false);
      setActivityForReport(null);
      showToast('Report submitted', 'success');
      // optionally refresh reports or activities here
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to submit report';
      setSubmitError(msg);
      showToast(msg, 'error');
      console.error('Submit report error', err);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // --- Status helpers (improved) ---
  // Determine if activity is overdue (endDate is before today and not completed)
  const isOverdue = (activity) => {
    try {
      if (!activity.endDate) return false;
      const end = new Date(activity.endDate);
      const today = new Date();
      // compare dates only (ignore time)
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return !activity.isDone && endDateOnly < todayOnly;
    } catch (e) {
      return false;
    }
  };

  const getStatusLabel = (activity) => {
    if (activity.isDone || (activity.status && activity.status.toLowerCase() === 'completed')) return 'Completed';
    if (isOverdue(activity)) return 'Overdue';
    if (activity.status && activity.status.toLowerCase().includes('progress')) return 'In Progress';
    // default
    return 'Todo';
  };

  const getStatusClasses = (activity) => {
    const label = getStatusLabel(activity);
    switch (label) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // UI modal open helpers
  const openEditModal = (activity) => { setActivityToEdit(activity); setShowEditModal(true); };
  const openDeleteModal = (activity) => { setActivityToDelete(activity); setShowDeleteModal(true); };

  return (
    <>
      {/* toast */}
      {toast.visible && (
        <div className={`fixed top-5 right-5 p-3 rounded shadow text-white z-50 ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'success' ? 'bg-green-600' : 'bg-blue-600'}`}>
          {toast.message}
        </div>
      )}

      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Activity Management</h1>
              <p className="text-gray-500 mt-1">Manage activities for your tasks.</p>
            </div>
            {hasManagePermission && (
              <div className="mt-3 sm:mt-0">
                <button onClick={() => setShowCreateModal(true)} disabled={!selectedTaskId} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                  <Plus className="inline-block mr-2" /> New Activity
                </button>
              </div>
            )}
          </header>

          {/* Task selector */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold flex items-center"><ClipboardList className="mr-2" /> Select a Task</h2>
            <div className="mt-4">
              <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} className="w-full md:w-1/2 px-4 py-2 rounded-lg border">
                {isLoadingTasks ? <option>Loading tasks...</option> : tasks.map(t => <option key={t.id} value={t.id}>{t.title || t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Activities */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Activities</h2>
            </div>

            {isLoadingActivities ? (
              <div className="py-12 text-center"><Loader className="animate-spin h-8 w-8" /></div>
            ) : activities.length === 0 ? (
              <div className="py-12 text-center text-gray-500">Select a task to view activities or there are no activities.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities.map(activity => (
                  <div key={activity.id} className="bg-gray-50 rounded-lg p-5 border flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg pr-2">{activity.title}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClasses(activity)}`}>
                          {getStatusLabel(activity)}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3 min-h-[60px]">{activity.description || 'No description provided.'}</p>
                      <div className="text-xs text-gray-500 space-y-1 mb-4">
                        <div><strong>Start:</strong> {activity.startDate ? new Date(activity.startDate).toLocaleDateString() : '—'}</div>
                        <div><strong>End:</strong> {activity.endDate ? new Date(activity.endDate).toLocaleDateString() : '—'}</div>
                      </div>
                      {activity.targetMetric && <div className="text-xs text-gray-600">Target: {JSON.stringify(activity.targetMetric)}</div>}
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-200 pt-3 mt-3">
                      <span className="text-xs text-gray-400">ID: {activity.id}</span>
                      <div className="flex items-center gap-2">
                        {/* Submit button (visible if user has 'view_reports' permission) */}
                        {canSubmitReport && (
                          <button onClick={() => openSubmitFor(activity)} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm" title="Submit report for this activity">
                            <FileText className="inline-block mr-1" /> Submit
                          </button>
                        )}

                        {/* Edit/Delete for managers */}
                        {hasManagePermission && (
                          <>
                            <button onClick={() => openEditModal(activity)} className="px-2 py-1 border rounded">Edit</button>
                            <button onClick={() => openDeleteModal(activity)} className="px-2 py-1 border rounded">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals: Create/Edit Activity */}
      <ActivityFormModal
        isOpen={showCreateModal || showEditModal}
        onClose={() => { setShowCreateModal(false); setShowEditModal(false); setActivityToEdit(null); }}
        onSubmit={showEditModal ? handleUpdateActivity : handleCreateActivity}
        initialData={activityToEdit}
        isSubmitting={isSubmittingActivity}
      />

      {/* Delete confirmation */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteActivity}
        activityTitle={activityToDelete?.title}
        isSubmitting={isSubmittingActivity}
      />

      {/* Submit report modal (opened from activity card) */}
      <ReportSubmitModal
        isOpen={showReportModal}
        onClose={() => { setShowReportModal(false); setActivityForReport(null); setSubmitError(null); }}
        activity={activityForReport}
        onSubmit={handleSubmitReport}
        submitting={isSubmittingReport}
        submitError={submitError}
      />
    </>
  );
}

/* -------------------------
   Helper components below
   (ActivityFormModal, DeleteConfirmationModal, ReportSubmitModal)
   ------------------------- */

function ActivityFormModal({ isOpen, onClose, onSubmit, initialData, isSubmitting }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({ title: '', description: '', status: 'Todo', startDate: '', endDate: '' });

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit) setForm({
      title: initialData.title || '',
      description: initialData.description || '',
      status: initialData.status || 'Todo',
      startDate: initialData.startDate ? initialData.startDate.split('T')[0] : '',
      endDate: initialData.endDate ? initialData.endDate.split('T')[0] : '',
    });
    else setForm({ title: '', description: '', status: 'Todo', startDate: '', endDate: '' });
  }, [isOpen, initialData, isEdit]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.endDate && form.startDate && new Date(form.endDate) < new Date(form.startDate)) {
      alert("End date cannot be before start date.");
      return;
    }
    onSubmit({
      title: form.title,
      description: form.description,
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null
    });
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">{isEdit ? 'Edit Activity' : 'Create New Activity'}</h2>
          <button onClick={onClose} className="text-gray-500"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-sm mb-1">Title *</label><input name="title" value={form.title} onChange={handleChange} required className="w-full px-3 py-2 rounded-lg border" /></div>
          <div><label className="block text-sm mb-1">Description</label><textarea name="description" value={form.description} onChange={handleChange} rows="3" className="w-full px-3 py-2 rounded-lg border" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm mb-1">Start Date *</label><input type="date" name="startDate" value={form.startDate} onChange={handleChange} required className="w-full px-3 py-2 rounded-lg border" /></div>
            <div><label className="block text-sm mb-1">End Date *</label><input type="date" name="endDate" value={form.endDate} onChange={handleChange} required className="w-full px-3 py-2 rounded-lg border" /></div>
          </div>
          <div><label className="block text-sm mb-1">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border">
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded">{isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, activityTitle, isSubmitting }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center"><AlertCircle className="mr-2" /> Confirm Deletion</h2>
        </div>
        <div className="p-6">
          <p>Are you sure you want to delete the activity <strong>{activityTitle}</strong>? This action cannot be undone.</p>
          <div className="mt-6 flex justify-end space-x-3">
            <button onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
            <button onClick={onConfirm} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded">{isSubmitting ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportSubmitModal({ isOpen, onClose, activity, onSubmit, submitting, submitError }) {
  const [metrics, setMetrics] = useState([{ key: '', value: '' }]);
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [narrative, setNarrative] = useState('');
  const [statusSelect, setStatusSelect] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMetrics([{ key: '', value: '' }]);
      setFiles([]);
      setFilePreviews([]);
      setNarrative('');
      setStatusSelect('');
    }
  }, [isOpen, activity]);

  const addMetric = () => setMetrics(prev => [...prev, { key: '', value: '' }]);
  const removeMetric = (i) => setMetrics(prev => prev.filter((_, idx) => idx !== i));
  const changeMetric = (i, field, val) => setMetrics(prev => { const c = [...prev]; c[i][field] = val; return c; });

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    setFilePreviews(selected.map(f => ({ name: f.name, url: URL.createObjectURL(f), isImage: f.type.startsWith('image/') })));
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    if (!activity) return;
    const reportData = {
      narrative: narrative || null,
      metrics_data: JSON.stringify(metrics.reduce((acc, m) => { if (m.key && m.value) acc[m.key] = m.value; return acc; }, {})),
      new_status: statusSelect || null
    };
    await onSubmit(reportData, files);
  };

  if (!isOpen || !activity) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Submit Report for: {activity.title}</h3>
          <button onClick={onClose} className="text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm mb-1">Narrative</label>
            <textarea value={narrative} onChange={e => setNarrative(e.target.value)} rows={4} required className="w-full rounded-md border px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm mb-1">Metrics</label>
            <div className="space-y-2">
              {metrics.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={m.key} onChange={e => changeMetric(i, 'key', e.target.value)} placeholder="Metric name" className="flex-1 rounded-md border px-2 py-1" />
                  <input value={m.value} onChange={e => changeMetric(i, 'value', e.target.value)} placeholder="Metric value" className="flex-1 rounded-md border px-2 py-1" />
                  <button type="button" onClick={() => removeMetric(i)} className="text-red-600 px-2">Remove</button>
                </div>
              ))}
              <button type="button" onClick={addMetric} className="text-sm text-blue-600">+ Add Metric</button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Update Activity Status (optional)</label>
            <select value={statusSelect} onChange={e => setStatusSelect(e.target.value)} className="w-full rounded-md border px-2 py-2">
              <option value="">Keep current status</option>
              <option value="Done">Mark as Done</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Attachments</label>
            <input type="file" multiple onChange={handleFileChange} />
            <div className="mt-2 grid grid-cols-4 gap-2">
              {filePreviews.map((f, idx) => (
                <div key={idx} className="text-xs">
                  {f.isImage ? <img src={f.url} alt={f.name} className="h-20 w-full object-cover rounded" /> : <div className="h-20 flex items-center justify-center rounded border">{f.name}</div>}
                  <div className="truncate mt-1">{f.name}</div>
                </div>
              ))}
            </div>
          </div>

          {submitError && <div className="text-red-600">{submitError}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded">{submitting ? 'Submitting...' : 'Submit Report'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
