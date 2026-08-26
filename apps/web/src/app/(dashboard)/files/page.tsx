'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api-client';
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
  Trash2,
  FolderOpen,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes, formatDate } from '../../../lib/utils';
import { MAX_FILE_SIZE } from '../../../lib/constants';
import { uploadErrorMessageKey } from '../../../lib/upload-error';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';

const ALL_SUBJECTS_VALUE = '__all-subjects__';
const ALL_FILE_TYPES_VALUE = '__all-file-types__';
const NO_SUBJECT_VALUE = '__no-subject__';

const createUploadId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export default function FilesPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    originalName: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  const loadData = useCallback(async (page = 1, showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
      setLoadError(false);
    }
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
      setLoadError(false);
    } catch {
      if (showSpinner) setLoadError(true);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [search, subjectId, fileType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(1);
    }, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [search, subjectId, fileType, loadData]);

  useEffect(() => {
    const hasProcessing = filesList.some(
      (file) => file.processingStatus === 'pending' || file.processingStatus === 'processing'
    );

    if (hasProcessing) {
      const interval = setInterval(() => {
        loadData(pagination.page, false);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [filesList, pagination.page, loadData]);

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
    const uploadId = createUploadId();

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        const chunk = selectedFile.slice(start, end, selectedFile.type);

        const chunkFormData = new FormData();
        chunkFormData.append('file', chunk, selectedFile.name);
        chunkFormData.append('uploadId', uploadId);
        chunkFormData.append('chunkIndex', i.toString());
        chunkFormData.append('totalChunks', totalChunks.toString());
        chunkFormData.append('filename', selectedFile.name);
        chunkFormData.append('fileSize', selectedFile.size.toString());
        chunkFormData.append('mimeType', selectedFile.type || 'application/octet-stream');
        if (uploadTitle.trim()) {
          chunkFormData.append('title', uploadTitle.trim());
        }
        if (uploadSubjectId) {
          chunkFormData.append('subjectId', uploadSubjectId);
        }

        if (i === totalChunks - 1) {
          setUploadMessage(t('files.mergingAndAnalyzing'));
        } else {
          setUploadMessage(t('files.uploadingChunk', { chunk: i + 1, total: totalChunks }));
        }

        const response = await api.post<any>('/files/upload/chunk', chunkFormData);
        
        const progressPercent = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(progressPercent);

        if (i === totalChunks - 1) {
          const newFileId = response.id;
          setUploadStatus('success');
          setSelectedFile(null);
          setUploadSubjectId('');
          setUploadTitle('');
          router.push(`/files/${newFileId}`);
          return;
        }
      }
    } catch (err: unknown) {
      setUploadStatus('error');
      setUploadError(t(uploadErrorMessageKey(err)));
    } finally {
      setUploading(false);
    }
  };

  const resetUploadState = () => {
    setUploadStatus('idle');
    setSelectedFile(null);
    setUploadTitle('');
    setUploadProgress(0);
    setUploadMessage('');
    setUploadError('');
  };

  const handleUploadOpenChange = (open: boolean) => {
    if (!open && uploading) return;

    setUploadOpen(open);
    if (open) resetUploadState();
  };

  const handleFileSelection = (file: File | undefined) => {
    setUploadStatus('idle');
    setUploadError('');
    setSelectedFile(null);

    if (!file) return;

    const fileName = file.name.toLowerCase();
    const acceptedType =
      file.type === 'application/pdf' ||
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.docx');

    if (!acceptedType) {
      setUploadStatus('error');
      setUploadError(t('files.invalidType'));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadStatus('error');
      setUploadError(t('files.maxSize'));
      return;
    }

    setSelectedFile(file);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await api.delete(`/files/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success(t('files.deleteSuccess'));
      await loadData(pagination.page);
    } catch (err) {
      toast.error(t('files.deleteFailure'));
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(search || subjectId || fileType);

  const clearFilters = () => {
    setSearch('');
    setSubjectId('');
    setFileType('');
  };

  return (
    <Dialog
      open={uploadOpen}
      onOpenChange={handleUploadOpenChange}
      disablePointerDismissal={uploading}
    >
      <div className="relative flex flex-col gap-5 px-4 sm:gap-6 sm:px-5 lg:px-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2.5 text-2xl font-bold text-foreground">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen className="size-5" aria-hidden="true" />
          </span>
          <span>{t('files.title')}</span>
        </h2>
        <DialogTrigger render={<Button size="lg" className="w-full gap-2 font-bold sm:w-auto" />}>
          <Upload className="size-4.5" aria-hidden="true" />
          <span>{t('dashboard.uploadNewFile')}</span>
        </DialogTrigger>
      </div>

      {/* Filters Bar */}
      <Card
        className="grid grid-cols-1 gap-4 bg-card/70 p-4 ring-1 ring-border md:grid-cols-2 lg:grid-cols-4"
        aria-label={t('files.filtersTitle')}
      >
        {/* Search */}
        <div className="flex min-w-0 flex-col gap-1.5 md:col-span-2">
          <label htmlFor="files-search" className="text-xs font-bold text-muted-foreground">
            {t('common.search')}
          </label>
          <Input
            id="files-search"
            placeholder={t('files.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 bg-background/45 px-3.5 py-2.5"
            icon={<Search className="size-4.5" aria-hidden="true" />}
          />
        </div>

        {/* Subject Filter */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            id="files-subject-filter-label"
            className="text-xs font-bold text-muted-foreground"
          >
            {t('files.subjectFilter')}
          </span>
          <Select
            value={subjectId || ALL_SUBJECTS_VALUE}
            onValueChange={(value) =>
              setSubjectId(value === ALL_SUBJECTS_VALUE || value === null ? '' : value)
            }
          >
            <SelectTrigger
              aria-labelledby="files-subject-filter-label"
              className="h-10 w-full min-w-0 bg-background/45 px-3.5 py-2.5 text-foreground"
            >
              <SelectValue>
                {subjectId
                  ? subjectsList.find((subject) => subject.id === subjectId)?.name ??
                    t('files.allSubjects')
                  : t('files.allSubjects')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent dir={locale === 'ar' ? 'rtl' : 'ltr'}>
              <SelectItem value={ALL_SUBJECTS_VALUE}>
                {t('files.allSubjects')}
              </SelectItem>
              {subjectsList.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Type Filter */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            id="files-type-filter-label"
            className="text-xs font-bold text-muted-foreground"
          >
            {t('files.fileTypeFilter')}
          </span>
          <Select
            value={fileType || ALL_FILE_TYPES_VALUE}
            onValueChange={(value) =>
              setFileType(value === ALL_FILE_TYPES_VALUE || value === null ? '' : value)
            }
          >
            <SelectTrigger
              aria-labelledby="files-type-filter-label"
              className="h-10 w-full min-w-0 bg-background/45 px-3.5 py-2.5 text-foreground"
            >
              <SelectValue>
                {fileType === 'pdf'
                  ? 'PDF'
                  : fileType === 'docx'
                    ? 'Word'
                    : fileType === 'image'
                      ? 'Image'
                      : t('files.allTypes')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent dir={locale === 'ar' ? 'rtl' : 'ltr'}>
              <SelectItem value={ALL_FILE_TYPES_VALUE}>
                {t('files.allTypes')}
              </SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="docx">Word</SelectItem>
              <SelectItem value="image">{t('files.fileTypeImage')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Files List / Grid */}
      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-3 text-muted-foreground" role="status">
          <Spinner className="size-6" aria-hidden="true" />
          <span className="text-sm font-medium">{t('common.loading')}</span>
        </div>
      ) : loadError ? (
        <Card className="mx-auto w-full max-w-xl items-center gap-4 bg-card/70 px-6 py-8 text-center ring-1 ring-border">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">{t('files.loadErrorTitle')}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{t('files.loadErrorDescription')}</p>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={() => loadData(1)}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t('files.retryLoad')}
          </Button>
        </Card>
      ) : filesList.length === 0 ? (
        <Card className="mx-auto w-full max-w-xl items-center gap-4 bg-card/70 px-6 py-9 text-center ring-1 ring-border">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {hasActiveFilters ? (
              <Search className="size-7" aria-hidden="true" />
            ) : (
              <FileText className="size-7" aria-hidden="true" />
            )}
          </span>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">
              {hasActiveFilters ? t('files.noResultsTitle') : t('files.emptyTitle')}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {hasActiveFilters ? t('files.noResultsDescription') : t('files.emptyState')}
            </p>
          </div>
          {hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={clearFilters}>
              {t('files.clearFilters')}
            </Button>
          ) : (
            <DialogTrigger render={<Button className="gap-2" />}>
              <Upload className="size-4" aria-hidden="true" />
              {t('dashboard.uploadNewFile')}
            </DialogTrigger>
          )}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filesList.map((file) => {
              const isCompleted = file.processingStatus === 'completed';
              const isFailed = file.processingStatus === 'failed';
              const isPending = file.processingStatus === 'pending';

              return (
                <Card
                  key={file.id}
                  className="group relative min-h-48 justify-between gap-0 bg-card/70 p-0 ring-1 ring-border transition duration-200 hover:-translate-y-0.5 hover:bg-card hover:shadow-lg hover:shadow-black/10"
                >
                  <Link
                    href={`/files/${file.id}`}
                    className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    aria-label={t('files.openFile', {
                      fileName: file.titleSource === 'fallback'
                        ? t('files.untitledDocument')
                        : file.title ?? file.originalName,
                    })}
                  />

                  <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-4 p-5">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                        <FileText className="size-6" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <h3 className="block truncate text-sm font-bold text-foreground">
                          {file.titleSource === 'fallback'
                            ? t('files.untitledDocument')
                            : file.title ?? file.originalName}
                        </h3>
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatBytes(file.fileSize)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(file)}
                      className="pointer-events-auto relative z-10 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t('files.deleteFileNamed', { fileName: file.originalName })}
                    >
                      <Trash2 className="size-4.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="pointer-events-none relative z-[1] flex items-end justify-between gap-3 border-t border-border/70 px-5 py-4 text-xs">
                    <div className="min-w-0 space-y-1">
                      <span className="block text-muted-foreground">{t('files.date')}</span>
                      <span className="block truncate font-semibold text-foreground">
                        {formatDate(file.createdAt, locale)}
                      </span>
                    </div>

                    <Badge variant={isCompleted ? 'success' : isFailed ? 'danger' : 'warning'}>
                      {isCompleted ? (
                        <CheckCircle aria-hidden="true" />
                      ) : isFailed ? (
                        <AlertTriangle aria-hidden="true" />
                      ) : isPending ? (
                        <Clock3 aria-hidden="true" />
                      ) : (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      )}
                      {isCompleted
                        ? t('files.statusCompleted')
                        : isFailed
                          ? t('files.statusFailed')
                          : isPending
                            ? t('files.statusPending')
                            : t('files.statusProcessing')}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>

          {pagination.totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-3 pt-1"
              aria-label={t('files.paginationLabel')}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1)}
              >
                {locale === 'ar' ? (
                  <ChevronRight className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronLeft className="size-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{t('files.previousPage')}</span>
              </Button>
              <span className="min-w-24 text-center text-xs font-semibold text-muted-foreground" aria-live="polite">
                {t('files.pageIndicator', {
                  page: pagination.page,
                  total: pagination.totalPages,
                })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadData(pagination.page + 1)}
              >
                <span className="hidden sm:inline">{t('files.nextPage')}</span>
                {locale === 'ar' ? (
                  <ChevronLeft className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-4" aria-hidden="true" />
                )}
              </Button>
            </nav>
          )}
        </>
      )}

      </div>

      <DialogContent
        initialFocus={fileInputRef}
        showCloseButton={!uploading}
        closeLabel={t('common.close')}
        className="studyai-dashboard-theme gap-5 overflow-hidden rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Upload className="size-4.5" aria-hidden="true" />
            </span>
            <span>{t('dashboard.uploadNewFile')}</span>
          </DialogTitle>
          <DialogDescription>
            {t('files.uploadRequirements')}.{' '}
            {t('files.uploadDescription')}
          </DialogDescription>
        </DialogHeader>

        {uploading ? (
          <div
            className="flex flex-col items-center justify-center gap-5 py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <Spinner className="size-9" aria-hidden="true" />
            <div className="w-full flex flex-col gap-2">
              <div className="flex justify-between gap-3 px-1 text-xs font-semibold text-muted-foreground">
                <span>{uploadMessage}</span>
                <span aria-hidden="true">{uploadProgress}%</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={t('files.uploadProgress')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
                aria-valuetext={`${uploadProgress}%`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('files.uploadKeepOpen')}
            </p>
          </div>
        ) : uploadStatus === 'success' ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <CheckCircle
              className="size-14 text-emerald-500"
              aria-hidden="true"
            />
            <h5 className="text-base font-bold text-foreground">
              {t('files.uploadSuccess')}
            </h5>
            <p className="text-xs font-medium text-muted-foreground">
              {t('files.uploadSuccessDescription')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="upload-title" className="text-sm font-medium text-foreground">
                {t('files.documentTitle')}
              </label>
              <Input
                id="upload-title"
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                maxLength={255}
                placeholder={t('files.documentTitlePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('files.documentTitleHelp')}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                id="upload-subject-label"
                htmlFor="upload-subject"
                className="text-sm font-medium text-foreground"
              >
                {t('files.subject')}
              </label>
              <Select
                value={uploadSubjectId || NO_SUBJECT_VALUE}
                onValueChange={(value) =>
                  setUploadSubjectId(value === NO_SUBJECT_VALUE || value === null ? '' : value)
                }
              >
                <SelectTrigger
                  id="upload-subject"
                  aria-labelledby="upload-subject-label"
                  className="h-10 w-full min-w-0 bg-background/45 px-3.5 py-2.5 text-foreground"
                >
                  <SelectValue>
                    {uploadSubjectId
                      ? subjectsList.find((subject) => subject.id === uploadSubjectId)?.name ??
                        t('files.noSubject')
                      : t('files.noSubject')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                  <SelectItem value={NO_SUBJECT_VALUE}>
                    {t('files.noSubject')}
                  </SelectItem>
                  {subjectsList.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label
              htmlFor="upload-file"
              className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-background/35 px-5 py-7 text-center transition-colors hover:border-primary/70 hover:bg-background/55 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40"
            >
              <input
                id="upload-file"
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelection(e.target.files?.[0])}
                className="sr-only"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                aria-describedby={`upload-file-requirements${
                  uploadError ? ' upload-file-error' : ''
                }`}
                aria-invalid={uploadStatus === 'error'}
              />
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                {selectedFile ? (
                  <FileText className="size-6" aria-hidden="true" />
                ) : (
                  <Upload className="size-6" aria-hidden="true" />
                )}
              </span>
              <span className="flex flex-col gap-1">
                <span className="max-w-[280px] truncate text-sm font-semibold text-foreground">
                  {selectedFile ? selectedFile.name : t('files.uploadZone')}
                </span>
                {selectedFile && (
                  <span className="text-xs font-semibold text-primary">
                    {formatBytes(selectedFile.size)}
                  </span>
                )}
                <span
                  id="upload-file-requirements"
                  className="text-xs text-muted-foreground"
                >
                  {t('files.uploadRequirements')}
                </span>
              </span>
            </label>

            {uploadStatus === 'error' && (
              <div
                id="upload-file-error"
                role="alert"
                className="flex items-center gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3.5 text-sm text-destructive"
              >
                <AlertTriangle
                  className="w-6 h-6 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <p className="font-bold">
                    {t('files.uploadFailed')}
                  </p>
                  <p className="text-xs">{uploadError}</p>
                </div>
              </div>
            )}

            <DialogFooter className="mt-2">
              <DialogClose
                render={<Button type="button" variant="outline" />}
              >
                {t('common.cancel')}
              </DialogClose>
              <Button
                type="submit"
                disabled={!selectedFile}
                className="font-bold py-2.5"
              >
                <span>
                  {t('files.startUpload')}
                </span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent initialFocus={deleteCancelRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('files.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('files.deleteDescription', {
                fileName: deleteTarget?.originalName ?? t('files.unnamedFile'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={deleteCancelRef} disabled={deleting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              loading={deleting}
              onClick={handleDelete}
            >
              {t('files.deleteFile')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
