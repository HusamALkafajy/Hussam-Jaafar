'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useLocale } from '../../../hooks/use-locale';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import {
  FileText,
  Upload,
  Search,
  BookOpen,
  Trash2,
  FolderOpen,
  Filter,
  X,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { formatBytes, formatDate } from '../../../lib/utils';

export default function FilesPage() {
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [filesList, setFilesList] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Filters
  const [search, setSearch] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [fileType, setFileType] = useState('');

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSubjectId, setUploadSubjectId] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async (page = 1) => {
    setLoading(true);
    try {
      const q = [`page=${page}`, `limit=10`];
      if (search) q.push(`search=${encodeURIComponent(search)}`);
      if (subjectId) q.push(`subjectId=${subjectId}`);
      if (fileType) q.push(`fileType=${fileType}`);

      const [filesRes, subjectsRes] = await Promise.all([
        api.get<any>(`/files?${q.join('&')}`),
        api.get<any[]>('/subjects'),
      ]);

      setFilesList(filesRes.data || []);
      setPagination(filesRes.pagination);
      setSubjectsList(subjectsRes || []);
    } catch (e) {
      console.error('Failed to load files data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(1);
    }, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [search, subjectId, fileType]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadStatus('idle');
    setUploadError('');
    setUploadProgress(0);
    setUploadMessage('');

    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
    const uploadId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `upload-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        const chunk = selectedFile.slice(start, end);

        const chunkFormData = new FormData();
        chunkFormData.append('file', chunk, selectedFile.name);
        chunkFormData.append('uploadId', uploadId);
        chunkFormData.append('chunkIndex', i.toString());
        chunkFormData.append('totalChunks', totalChunks.toString());
        chunkFormData.append('filename', selectedFile.name);
        if (uploadSubjectId) {
          chunkFormData.append('subjectId', uploadSubjectId);
        }

        if (i === totalChunks - 1) {
          setUploadMessage(t('files.mergingAndAnalyzing') || 'Merging and analyzing...');
        } else {
          setUploadMessage(
            (t('files.uploadingChunk') || 'Uploading chunk {chunk} of {total}...')
              .replace('{chunk}', (i + 1).toString())
              .replace('{total}', totalChunks.toString())
          );
        }

        await api.post('/files/upload/chunk', chunkFormData);
        
        const progressPercent = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(progressPercent);
      }

      setUploadStatus('success');
      setSelectedFile(null);
      setUploadSubjectId('');
      // Invalidate list
      loadData(1);
      setTimeout(() => setUploadOpen(false), 1500);
    } catch (err: any) {
      setUploadStatus('error');
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await api.delete(`/files/${id}`);
      loadData(pagination.page);
    } catch (err) {
      alert('Delete failed');
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FolderOpen className="w-6 h-6 text-indigo-400" />
          <span>{t('files.title')}</span>
        </h2>
        <Button
          onClick={() => {
            setUploadOpen(true);
            setUploadStatus('idle');
            setSelectedFile(null);
            setUploadProgress(0);
            setUploadMessage('');
            setUploadError('');
          }}
          className="gap-2 font-bold"
        >
          <Upload className="w-4.5 h-4.5" />
          <span>{t('dashboard.uploadNewFile')}</span>
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <Input
            id="search"
            placeholder={t('files.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4.5 h-4.5" />}
          />
        </div>

        {/* Subject Filter */}
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="px-3.5 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">{t('files.allSubjects')}</option>
          {subjectsList.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>

        {/* File Type Filter */}
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="px-3.5 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="">{t('files.allTypes')}</option>
          <option value="pdf">PDF</option>
          <option value="docx">Word</option>
          <option value="image">Image</option>
        </select>
      </div>

      {/* Files List / Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner className="w-8 h-8" />
        </div>
      ) : filesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
          <FileText className="w-16 h-16 text-slate-600 animate-pulse" />
          <p className="text-slate-400 text-center">{t('files.emptyState')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filesList.map((file) => (
            <Link key={file.id} href={`/files/${file.id}`} className="group block">
              <Card className="p-5 flex flex-col justify-between h-48 bg-slate-900/40 border-slate-800/45 relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform duration-200">
                      <FileText className="w-6 h-6 animate-pulse-glow" />
                    </div>
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <span className="text-sm font-bold text-slate-200 group-hover:text-white truncate block">
                        {file.originalName}
                      </span>
                      <span className="text-xs text-slate-500">{formatBytes(file.fileSize)}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(file.id, e)}
                    className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/30 pt-4 mt-4 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500">{t('files.date')}</span>
                    <span className="text-slate-300 font-semibold">{formatDate(file.createdAt, locale)}</span>
                  </div>

                  <Badge
                    variant={
                      file.processingStatus === 'completed'
                        ? 'success'
                        : file.processingStatus === 'failed'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {file.processingStatus === 'completed'
                      ? t('files.statusCompleted')
                      : file.processingStatus === 'failed'
                      ? t('files.statusFailed')
                      : t('files.statusProcessing')}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Upload Modal (HTML portal) */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-400" />
                <span>{t('dashboard.uploadNewFile')}</span>
              </h4>
              <button
                onClick={() => setUploadOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                <Spinner className="w-10 h-10 text-indigo-400" />
                <div className="w-full flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-slate-400 font-semibold px-1">
                    <span>{uploadMessage}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : uploadStatus === 'success' ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                <CheckCircle className="w-16 h-16 text-emerald-500" />
                <h5 className="text-base font-bold text-white">
                  {locale === 'ar' ? 'تم رفع الملف بنجاح!' : 'File uploaded successfully!'}
                </h5>
                <p className="text-xs text-slate-400 font-medium">
                  {locale === 'ar'
                    ? 'بدأ التحليل بالذكاء الاصطناعي في الخلفية وسيظهر الملف حال اكتماله.'
                    : 'AI analysis started in the background; file will appear once completed.'}
                </p>
              </div>
            ) : (
              <>
                {uploadStatus === 'error' && (
                  <div className="py-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-2.5">
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <p className="font-bold">{locale === 'ar' ? 'فشل رفع الملف' : 'Upload failed'}</p>
                      <p className="text-xs">{uploadError}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
                  {/* Subject Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-300">{t('files.subject')}</label>
                    <select
                      value={uploadSubjectId}
                      onChange={(e) => setUploadSubjectId(e.target.value)}
                      className="px-3.5 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="">{locale === 'ar' ? 'بلا مادة' : 'No Subject'}</option>
                      {subjectsList.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* File Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-850 hover:border-indigo-500 bg-slate-950/30 rounded-xl py-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer hover:bg-slate-950/50 transition-all group"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      accept=".pdf,.docx,image/*"
                    />
                    <div className="bg-indigo-500/10 p-3 rounded-lg text-indigo-400 group-hover:scale-105 transition-transform duration-200">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-slate-200 font-semibold truncate max-w-[280px]">
                        {selectedFile ? selectedFile.name : t('files.uploadZone')}
                      </p>
                      <p className="text-xs text-slate-500">{t('files.uploadRequirements')}</p>
                    </div>
                  </div>

                  <Button type="submit" disabled={!selectedFile} className="w-full font-bold py-2.5 mt-2">
                    <span>{locale === 'ar' ? 'بدء الرفع والتحليل' : 'Start Upload & Analysis'}</span>
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
