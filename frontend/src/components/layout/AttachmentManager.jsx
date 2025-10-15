// src/pages/AttachmentsPage.jsx
import React, { useEffect, useState } from "react";
import { fetchAttachments, deleteAttachment, downloadAttachment } from "../api/attachments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from "@/components/ui/table";
import { Loader2, Trash, Download } from "lucide-react";

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

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Attachments</h1>

      <Card className="shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 flex justify-center items-center">
              <Loader2 className="animate-spin h-6 w-6" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.length > 0 ? (
                  attachments.map((at) => (
                    <TableRow key={at.id}>
                      <TableCell>{at.id}</TableCell>
                      <TableCell>{at.fileName}</TableCell>
                      <TableCell>{at.fileType}</TableCell>
                      <TableCell>
                        {new Date(at.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(at.id)}
                          disabled={downloading === at.id}
                        >
                          {downloading === at.id ? (
                            <Loader2 className="animate-spin h-4 w-4" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="ml-1">Download</span>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(at.id)}
                        >
                          <Trash className="h-4 w-4" />
                          <span className="ml-1">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center p-4">
                      No attachments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
