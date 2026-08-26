'use client';

import React, { useState } from 'react';
import { MOCK_NOTES } from '../../../mocks/workspace';
import { Container } from '../../../components/ui/container';
import { Stack } from '../../../components/ui/stack';
import { Grid } from '../../../components/ui/grid';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from '../../../components/ui/page-header';
import { Search, Plus, MoreVertical, StickyNote, Star, Pin, FileText, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { useLocale } from '../../../hooks/use-locale';
import { formatDate } from '../../../lib/utils';
import { cn } from '../../../lib/utils';

export default function NotesPage() {
  const { locale } = useLocale();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'pinned'>('all');

  const filteredNotes = MOCK_NOTES.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(search.toLowerCase()) || note.preview.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    if (filter === 'favorites') return note.isFavorite;
    if (filter === 'pinned') return note.isPinned;
    return true;
  });

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const otherNotes = filteredNotes.filter(n => !n.isPinned);

  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <PageHeader className="pb-0 border-0">
            <PageHeaderHeading>My Notes</PageHeaderHeading>
            <PageHeaderDescription>Capture your thoughts and summarize your learning.</PageHeaderDescription>
          </PageHeader>
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search notes..." 
                className="ps-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0">
              <ArrowUpDown className="size-4" />
            </Button>
            <Button className="shrink-0 gap-2">
              <Plus className="size-4" />
              New Note
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b pb-4">
          <Button 
            variant={filter === 'all' ? 'default' : 'ghost'} 
            size="sm" 
            className={cn("rounded-full", filter === 'all' ? "bg-primary/10 text-primary hover:bg-primary/20" : "")}
            onClick={() => setFilter('all')}
          >
            All Notes
          </Button>
          <Button 
            variant={filter === 'pinned' ? 'default' : 'ghost'} 
            size="sm" 
            className={cn("rounded-full gap-2", filter === 'pinned' ? "bg-primary/10 text-primary hover:bg-primary/20" : "")}
            onClick={() => setFilter('pinned')}
          >
            <Pin className="size-3.5" /> Pinned
          </Button>
          <Button 
            variant={filter === 'favorites' ? 'default' : 'ghost'} 
            size="sm" 
            className={cn("rounded-full gap-2", filter === 'favorites' ? "bg-primary/10 text-primary hover:bg-primary/20" : "")}
            onClick={() => setFilter('favorites')}
          >
            <Star className="size-3.5" /> Favorites
          </Button>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <div className="p-4 bg-primary/10 text-primary rounded-full mb-4">
              <StickyNote className="size-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No notes found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {search || filter !== 'all' ? "No notes match your current filters." : "You haven't created any notes yet."}
            </p>
            {(search || filter !== 'all') ? (
              <Button variant="outline" onClick={() => { setSearch(''); setFilter('all'); }}>Clear Filters</Button>
            ) : (
              <Button className="gap-2">
                <Plus className="size-4" />
                Create Note
              </Button>
            )}
          </div>
        ) : (
          <Stack gap={8}>
            {pinnedNotes.length > 0 && filter !== 'pinned' && (
              <Stack gap={4}>
                <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                  <Pin className="size-4" /> Pinned
                </h3>
                <Grid cols={1} gap={4}>
                  {pinnedNotes.map(note => <NoteCard key={note.id} note={note} locale={locale} />)}
                </Grid>
              </Stack>
            )}

            {otherNotes.length > 0 && (
              <Stack gap={4}>
                {pinnedNotes.length > 0 && filter !== 'pinned' && (
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <FileText className="size-4" /> Recent
                  </h3>
                )}
                <Grid cols={1} gap={4}>
                  {otherNotes.map(note => <NoteCard key={note.id} note={note} locale={locale} />)}
                </Grid>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function NoteCard({ note, locale }: { note: any, locale: string }) {
  return (
    <Card className="flex flex-col h-[200px] hover:border-primary/50 transition-colors cursor-pointer group">
      <div className="p-5 flex-1 flex flex-col gap-2 relative">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">{note.title}</h3>
          <div className="flex items-center gap-1 shrink-0 bg-background">
            {note.isFavorite && <Star className="size-4 fill-amber-400 text-amber-400" />}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={e => e.stopPropagation()}>Open Note</DropdownMenuItem>
                <DropdownMenuItem onClick={e => e.stopPropagation()}>Rename</DropdownMenuItem>
                <DropdownMenuItem onClick={e => e.stopPropagation()}>
                  {note.isPinned ? "Unpin" : "Pin Note"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => e.stopPropagation()}>
                  {note.isFavorite ? "Remove Favorite" : "Add to Favorites"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => e.stopPropagation()} className="text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-4 flex-1">
          {note.preview}
        </p>
      </div>
      <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Edited {formatDate(note.updatedAt, locale)}</span>
        {note.subjectId && <Badge variant="outline" className="text-[10px]">Subject Linked</Badge>}
      </div>
    </Card>
  );
}

