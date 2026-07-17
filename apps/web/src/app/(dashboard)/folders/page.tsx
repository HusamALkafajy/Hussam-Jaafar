'use client';

import React, { useState } from 'react';
import { MOCK_FOLDERS, MOCK_DOCUMENTS } from '../../../mocks/workspace';
import { Container } from '../../../components/ui/container';
import { Stack } from '../../../components/ui/stack';
import { Grid } from '../../../components/ui/grid';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from '../../../components/ui/page-header';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
} from '../../../components/ui/breadcrumb';
import { Badge }
from '../../../components/ui/badge';
import { Folder as FolderIcon, FileText, Search, Plus, MoreVertical, FolderOpen, ArrowRight, Home } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { useLocale } from '../../../hooks/use-locale';
import { formatDate } from '../../../lib/utils';
import Link from 'next/link';

export default function FoldersPage() {
  const { locale } = useLocale();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Derived state for the mock navigation
  const currentFolder = currentFolderId ? MOCK_FOLDERS.find(f => f.id === currentFolderId) : null;
  const childFolders = MOCK_FOLDERS.filter(f => (f.parentId || null) === currentFolderId && f.name.toLowerCase().includes(search.toLowerCase()));
  const documents = currentFolderId 
    ? MOCK_DOCUMENTS.filter(d => d.folderId === currentFolderId && d.title.toLowerCase().includes(search.toLowerCase()))
    : MOCK_DOCUMENTS.filter(d => !d.folderId && d.title.toLowerCase().includes(search.toLowerCase()));

  // Build breadcrumbs
  const breadcrumbs = [];
  let curr = currentFolder;
  while (curr) {
    breadcrumbs.unshift(curr);
    curr = MOCK_FOLDERS.find(f => f.id === curr?.parentId);
  }

  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <PageHeader className="pb-0 border-0">
            <PageHeaderHeading>Files & Folders</PageHeaderHeading>
            <PageHeaderDescription>Organize your documents and study materials.</PageHeaderDescription>
          </PageHeader>
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search files..." 
                className="ps-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button className="shrink-0 gap-2">
              <Plus className="size-4" />
              New Folder
            </Button>
            <Button variant="outline" className="shrink-0 gap-2">
              <Plus className="size-4" />
              Upload
            </Button>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="bg-muted/30 p-3 rounded-lg border flex items-center">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink 
                   
                  onClick={() => setCurrentFolderId(null)}
                  className="flex items-center gap-1.5"
                >
                  <Home className="size-4" />
                  My Files
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={b.id}>
                  <BreadcrumbItem>
                    <ArrowRight className="size-3 text-muted-foreground rtl:-scale-x-100" />
                  </BreadcrumbItem>
                  <BreadcrumbItem>
                    <BreadcrumbLink 
                      
                      onClick={() => setCurrentFolderId(b.id)}
                      className={i === breadcrumbs.length - 1 ? "text-foreground font-semibold" : ""}
                    >
                      {b.name}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {(childFolders.length === 0 && documents.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <div className="p-4 bg-muted text-muted-foreground rounded-full mb-4">
              <FolderOpen className="size-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">This folder is empty</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {search ? "No files match your search query." : "Upload documents or create new folders to organize your work."}
            </p>
          </div>
        ) : (
          <Stack gap={6}>
            {/* Folders Section */}
            {childFolders.length > 0 && (
              <Stack gap={4}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Folders</h3>
                <Grid cols={1} gap={4}>
                  {childFolders.map(folder => (
                    <Card 
                      key={folder.id} 
                      className="p-4 flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer group"
                      onClick={() => setCurrentFolderId(folder.id)}
                    >
                      <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-lg group-hover:scale-110 transition-transform">
                        <FolderIcon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold line-clamp-1">{folder.name}</h4>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="size-4" />
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Open</DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Rename</DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>Move to...</DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Card>
                  ))}
                </Grid>
              </Stack>
            )}

            {/* Documents Section */}
            {documents.length > 0 && (
              <Stack gap={4}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documents</h3>
                <div className="flex flex-col gap-2">
                  {documents.map(doc => (
                    <Card key={doc.id} className="p-3 flex items-center gap-4 hover:border-primary/50 transition-colors group">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0 group-hover:scale-110 transition-transform">
                        <FileText className="size-5" />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <h4 className="font-semibold line-clamp-1">{doc.title}</h4>
                        <span className="text-xs text-muted-foreground">Added {formatDate(doc.createdAt, locale)} • {(doc.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                      <Badge variant="secondary" className="hidden sm:inline-flex uppercase shrink-0">{doc.type}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="size-4" />
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Read</DropdownMenuItem>
                          <DropdownMenuItem>Rename</DropdownMenuItem>
                          <DropdownMenuItem>Move to...</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Card>
                  ))}
                </div>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

