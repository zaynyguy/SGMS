import React, { useState, useEffect, useMemo } from 'react';

// --- Icon Components (using SVG for simplicity) ---
const ChevronDownIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
);
const DocumentTextIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const CheckCircleIcon = () => (
    <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const XCircleIcon = () => (
    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const ClockIcon = () => (
    <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);


// --- MOCK DATA: Simulates your database structure ---
const MOCK_DATA = {
    goals: [
        { id: 1, title: 'Launch V1 of Project Phoenix', progress: 50 },
        { id: 2, title: 'Increase Q3 User Signups by 20%', progress: 0 },
    ],
    tasks: [
        { id: 10, goalId: 1, title: 'User Management Backend', progress: 100 },
        { id: 11, goalId: 1, title: 'Frontend UI Implementation', progress: 0 },
        { id: 12, goalId: 2, title: 'Run Marketing Campaign', progress: 0 },
    ],
    activities: [
        { id: 101, taskId: 10, title: 'Develop Authentication Feature', status: 'Done' },
        { id: 102, taskId: 10, title: 'Setup User Database Schema', status: 'Done' },
        { id: 111, taskId: 11, title: 'Design Landing Page Mockups', status: 'In Progress' },
        { id: 112, taskId: 11, title: 'Component Library Setup', status: 'Not Started' },
        { id: 121, taskId: 12, title: 'Create Ad Copy', status: 'Not Started' },
    ],
    reports: [
        { id: 1, activityId: 101, userId: 1, username: 'john.doe', activityTitle: 'Develop Authentication Feature', taskTitle: 'User Management Backend', goalTitle: 'Launch V1 of Project Phoenix', createdAt: '2025-08-21T10:00:00Z', status: 'Approved', narrative: 'Initial development complete. Ready for QA.', adminComment: 'Looks good!', attachments: [{id: 1, fileName: 'auth_flow.pdf'}] },
        { id: 2, activityId: 111, userId: 2, username: 'jane.smith', activityTitle: 'Design Landing Page Mockups', taskTitle: 'Frontend UI Implementation', goalTitle: 'Launch V1 of Project Phoenix', createdAt: '2025-08-22T14:30:00Z', status: 'Pending', narrative: 'Initial wireframes for the landing page are complete. Seeking feedback on the layout.', adminComment: null, attachments: [{id: 2, fileName: 'landing_page_v1.png'}] },
    ],
};

// --- Helper Functions & Components ---

// A simple progress bar component
const ProgressBar = ({ progress }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
    </div>
);

// --- Report Submission Form Component ---
const ReportSubmissionForm = ({ activity, onClose, onSubmitReport }) => {
    const [narrative, setNarrative] = useState('');
    const [newStatus, setNewStatus] = useState(activity.status);
    const [files, setFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newReport = {
            id: Date.now(),
            activityId: activity.id,
            userId: 3, // Mock current user
            username: 'current.user',
            activityTitle: activity.title,
            taskTitle: '...', // In a real app, you'd fetch this
            goalTitle: '...', // In a real app, you'd fetch this
            createdAt: new Date().toISOString(),
            status: 'Pending',
            narrative,
            adminComment: null,
            attachments: files.map(f => ({ id: Date.now() + Math.random(), fileName: f.name })),
        };
        
        onSubmitReport(newReport, newStatus);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6 border-b">
                    <h3 className="text-xl font-semibold text-gray-900">Submit Report</h3>
                    <p className="text-sm text-gray-500 mt-1">For: {activity.title}</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        <div>
                            <label htmlFor="narrative" className="block text-sm font-medium text-gray-700 mb-1">Narrative</label>
                            <textarea id="narrative" rows="4" className="w-full p-2 border border-gray-300 rounded-md" value={narrative} onChange={(e) => setNarrative(e.target.value)} required />
                        </div>
                        <div>
                            <label htmlFor="new_status" className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                            <select id="new_status" className="w-full p-2 border border-gray-300 rounded-md bg-white" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                                <option>Not Started</option>
                                <option>In Progress</option>
                                <option>Done</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files))} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400">
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- User View Component ---
const UserView = ({ data, setData }) => {
    const [expandedGoals, setExpandedGoals] = useState({});
    const [expandedTasks, setExpandedTasks] = useState({});
    const [reportingActivity, setReportingActivity] = useState(null);

    const toggleGoal = (goalId) => setExpandedGoals(prev => ({ ...prev, [goalId]: !prev[goalId] }));
    const toggleTask = (taskId) => setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    
    const handleSubmitReport = (newReport, newActivityStatus) => {
        // This simulates the backend logic
        setData(prevData => {
            const newData = { ...prevData };
            
            // 1. Add the new report
            newData.reports = [...newData.reports, newReport];
            
            // NOTE: The 'Approved' logic is handled in the Admin view.
            // When a user submits, the activity status doesn't change until an admin approves it.
            // The `updateProgress` logic would run on the backend upon approval.
            // We will simulate this in the admin's `handleReview` function.
            
            return newData;
        });
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">My Goals & Activities</h2>
            {data.goals.map(goal => (
                <div key={goal.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="p-4 cursor-pointer flex justify-between items-center" onClick={() => toggleGoal(goal.id)}>
                        <div>
                            <h3 className="font-bold text-lg text-gray-800">{goal.title}</h3>
                            <div className="flex items-center space-x-2 mt-2">
                                <ProgressBar progress={goal.progress} />
                                <span className="text-sm font-medium text-gray-600">{goal.progress}%</span>
                            </div>
                        </div>
                        <ChevronDownIcon />
                    </div>
                    {expandedGoals[goal.id] && (
                        <div className="px-4 pb-4 pl-8 border-t border-gray-200">
                            {data.tasks.filter(t => t.goalId === goal.id).map(task => (
                                <div key={task.id} className="mt-4">
                                    <div className="p-2 cursor-pointer flex justify-between items-center rounded-md hover:bg-gray-50" onClick={() => toggleTask(task.id)}>
                                        <div>
                                            <h4 className="font-semibold text-gray-700">{task.title}</h4>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <ProgressBar progress={task.progress} />
                                                <span className="text-xs font-medium text-gray-500">{task.progress}%</span>
                                            </div>
                                        </div>
                                        <ChevronDownIcon />
                                    </div>
                                    {expandedTasks[task.id] && (
                                        <div className="pl-6 pt-2 space-y-2">
                                            {data.activities.filter(a => a.taskId === task.id).map(activity => (
                                                <div key={activity.id} className="flex justify-between items-center p-2 rounded-md">
                                                    <span className="text-gray-600">{activity.title}</span>
                                                    <button onClick={() => setReportingActivity(activity)} className="text-sm font-medium text-blue-600 hover:underline">Submit Report</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {reportingActivity && <ReportSubmissionForm activity={reportingActivity} onClose={() => setReportingActivity(null)} onSubmitReport={handleSubmitReport}/>}
        </div>
    );
};

// --- Admin Dashboard Component ---
const AdminDashboard = ({ data, setData }) => {
    const [filterStatus, setFilterStatus] = useState('All');
    
    const handleReview = (reportId, status, adminComment) => {
        // This simulates the entire backend `reviewReport` and `updateProgress` logic
        setData(prevData => {
            const newData = JSON.parse(JSON.stringify(prevData)); // Deep copy
            
            const report = newData.reports.find(r => r.id === reportId);
            if (!report) return newData;
            
            // 1. Update report status and comment
            report.status = status;
            report.adminComment = adminComment;
            
            if (status === 'Approved') {
                // 2. Update activity status
                const activity = newData.activities.find(a => a.id === report.activityId);
                if (activity) {
                    // In a real app, the new status would come from the report itself
                    activity.status = 'Done'; 
                }
                
                // 3. Recalculate progress (simulate `updateProgress`)
                const task = newData.tasks.find(t => t.id === activity.taskId);
                if (task) {
                    const taskActivities = newData.activities.filter(a => a.taskId === task.id);
                    const doneActivities = taskActivities.filter(a => a.status === 'Done').length;
                    task.progress = Math.round((doneActivities / taskActivities.length) * 100);
                    
                    const goal = newData.goals.find(g => g.id === task.goalId);
                    if (goal) {
                        const goalTasks = newData.tasks.filter(t => t.goalId === goal.id);
                        const totalProgress = goalTasks.reduce((sum, t) => sum + t.progress, 0);
                        goal.progress = Math.round(totalProgress / goalTasks.length);
                    }
                }
            }
            
            return newData;
        });
    };
    
    const filteredReports = useMemo(() => {
        if (filterStatus === 'All') return data.reports;
        return data.reports.filter(r => r.status === filterStatus);
    }, [data.reports, filterStatus]);

    return (
        <div className="space-y-4">
            <div className="md:flex md:items-center md:justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Review Reports</h2>
                <button onClick={() => alert("Generating Master Report...")} className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    Generate Master Report
                </button>
            </div>
            
            <div className="flex space-x-2 border-b border-gray-200 pb-2">
                {['All', 'Pending', 'Approved', 'Rejected'].map(status => (
                    <button key={status} onClick={() => setFilterStatus(status)} className={`px-3 py-1.5 text-sm font-medium rounded-md ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {status}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {filteredReports.map(report => (
                    <ReportCard key={report.id} report={report} onReview={handleReview} />
                ))}
                 {filteredReports.length === 0 && <p className="text-center text-gray-500 py-8">No reports match the current filter.</p>}
            </div>
        </div>
    );
};

// Card for displaying a single report in the admin view
const ReportCard = ({ report, onReview }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [adminComment, setAdminComment] = useState('');

    const statusInfo = {
        Pending: { icon: <ClockIcon />, color: 'yellow' },
        Approved: { icon: <CheckCircleIcon />, color: 'green' },
        Rejected: { icon: <XCircleIcon />, color: 'red' },
    };

    const handleReviewClick = (status) => {
        if (status === 'Rejected' && !adminComment) {
            alert('A comment is required when rejecting a report.');
            return;
        }
        onReview(report.id, status, adminComment);
        setIsExpanded(false);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-4 flex items-start justify-between">
                <div className="flex items-start space-x-4">
                    <div>{statusInfo[report.status].icon}</div>
                    <div>
                        <p className="font-semibold text-gray-800">{report.activityTitle}</p>
                        <p className="text-sm text-gray-500">Submitted by <span className="font-medium">{report.username}</span> on {new Date(report.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                <button onClick={() => setIsExpanded(!isExpanded)} className="text-sm font-medium text-blue-600 hover:underline">
                    {isExpanded ? 'Collapse' : 'Details'}
                </button>
            </div>
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200">
                    <div className="py-4 space-y-3 text-sm">
                        <p><strong className="font-medium text-gray-700">Narrative:</strong> {report.narrative}</p>
                        {report.attachments.length > 0 && 
                            <div>
                                <strong className="font-medium text-gray-700">Attachments:</strong>
                                <ul className="list-disc pl-5 mt-1">
                                    {report.attachments.map(att => <li key={att.id}><a href="#" className="text-blue-600 hover:underline">{att.fileName}</a></li>)}
                                </ul>
                            </div>
                        }
                        {report.adminComment && <p><strong className="font-medium text-gray-700">Admin Feedback:</strong> {report.adminComment}</p>}
                    </div>
                    
                    {report.status === 'Pending' && (
                        <div className="pt-4 border-t border-gray-200 space-y-3">
                            <textarea value={adminComment} onChange={(e) => setAdminComment(e.target.value)} placeholder="Add an optional comment for approval, required for rejection..." rows="2" className="w-full p-2 border border-gray-300 rounded-md text-sm"></textarea>
                            <div className="flex justify-end space-x-2">
                                <button onClick={() => handleReviewClick('Rejected')} className="px-3 py-1.5 text-sm font-medium bg-red-100 text-red-800 rounded-md hover:bg-red-200">Reject</button>
                                <button onClick={() => handleReviewClick('Approved')} className="px-3 py-1.5 text-sm font-medium bg-green-100 text-green-800 rounded-md hover:bg-green-200">Approve</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    const [view, setView] = useState('user'); // 'user' or 'admin'
    const [data, setData] = useState(MOCK_DATA);

    return (
        <div className="bg-gray-50 min-h-screen font-sans">
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                <header className="mb-8">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <DocumentTextIcon />
                            <h1 className="text-3xl font-bold text-gray-900">Project Reporting System</h1>
                        </div>
                        <div className="flex items-center p-1 bg-gray-200 rounded-lg">
                            <button onClick={() => setView('user')} className={`px-3 py-1 text-sm font-medium rounded-md ${view === 'user' ? 'bg-white shadow' : 'text-gray-600'}`}>
                                User View
                            </button>
                            <button onClick={() => setView('admin')} className={`px-3 py-1 text-sm font-medium rounded-md ${view === 'admin' ? 'bg-white shadow' : 'text-gray-600'}`}>
                                Admin View
                            </button>
                        </div>
                    </div>
                </header>
                
                <main>
                    {view === 'user' ? <UserView data={data} setData={setData} /> : <AdminDashboard data={data} setData={setData} />}
                </main>
            </div>
        </div>
    );
}
