// src/pages/AttachmentsPage.jsx
import React, { useEffect, useState } from "react";
import { fetchAttachments, deleteAttachment, downloadAttachment } from "../api/attachment";
import { Loader2, Trash, Download, File, FileText, Image } from "lucide-react";

export default function AttachmentsPage({ reportId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchAttachments(reportId);
      setAttachments(data);
    } catch (err) {
      console.error("Error fetching attachments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reportId]);

  const handleDownload = async (id) => {
    try {
      setDownloading(id);
      const { blob, filename } = await downloadAttachment(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this attachment?")) return;
    try {
      await deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // Helper function to get file icon based on file type
  const getFileIcon = (fileType) => {
    if (fileType.includes('image')) return <Image className="h-5 w-5" />;
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attachments</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage files attached to this report
            </p>
          </div>
        </div>

        {/* Attachments Table/Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading attachments...</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-left">
                    <tr>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">File</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Uploaded</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {attachments.length > 0 ? (
                      attachments.map((at) => (
                        <tr key={at.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 text-indigo-600 dark:text-indigo-400">
                                {getFileIcon(at.fileType)}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">{at.fileName}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">ID: {at.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full">
                              {at.fileType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(at.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleDownload(at.id)}
                              disabled={downloading === at.id}
                              className="inline-flex items-center px-3 py-1.5 rounded-md text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 disabled:opacity-50 transition-colors"
                            >
                              {downloading === at.id ? (
                                <Loader2 className="animate-spin h-4 w-4 mr-1" />
                              ) : (
                                <Download className="h-4 w-4 mr-1" />
                              )}
                              Download
                            </button>
                            <button
                              onClick={() => handleDelete(at.id)}
                              className="inline-flex items-center px-3 py-1.5 rounded-md text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                            >
                              <Trash className="h-4 w-4 mr-1" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <File className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No attachments found</p>
                            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">No files have been attached to this report</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden">
                {attachments.length > 0 ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {attachments.map((at) => (
                      <div key={at.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 h-10 w-10 text-indigo-600 dark:text-indigo-400 mt-1">
                            {getFileIcon(at.fileType)}
                          </div>
                          <div className="ml-4 flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{at.fileName}</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full">
                                {at.fileType}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              Uploaded: {new Date(at.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {at.id}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex space-x-2">
                          <button
                            onClick={() => handleDownload(at.id)}
                            disabled={downloading === at.id}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 disabled:opacity-50 transition-colors"
                          >
                            {downloading === at.id ? (
                              <Loader2 className="animate-spin h-4 w-4 mr-1" />
                            ) : (
                              <Download className="h-4 w-4 mr-1" />
                            )}
                            Download
                          </button>
                          <button
                            onClick={() => handleDelete(at.id)}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                          >
                            <Trash className="h-4 w-4 mr-1" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <File className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No attachments found</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">No files have been attached to this report</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}