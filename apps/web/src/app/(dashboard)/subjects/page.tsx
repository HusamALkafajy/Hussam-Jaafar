'use client';

import React, { useState } from 'react';
import { MOCK_SUBJECTS } from '../../../mocks/workspace';
import { Container } from '../../../components/ui/container';
import { Stack } from '../../../components/ui/stack';
import { Grid } from '../../../components/ui/grid';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from '../../../components/ui/page-header';
import { Search, Plus, LayoutGrid, List, MoreVertical, FlaskConical, Brain, FunctionSquare, Globe, GraduationCap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { useLocale } from '../../../hooks/use-locale';
import { formatDate } from '../../../lib/utils';

const ICON_MAP: Record<string, any> = {
  'flask-conical': FlaskConical,
  'brain': Brain,
  'function-square': FunctionSquare,
  'globe': Globe,
};

const COLOR_MAP: Record<string, string> = {
  'blue': 'text-blue-500 bg-blue-500/10',
  'purple': 'text-purple-500 bg-purple-500/10',
  'green': 'text-green-500 bg-green-500/10',
  'orange': 'text-orange-500 bg-orange-500/10',
};

export default function SubjectsPage() {
  const { locale } = useLocale();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');

  const filteredSubjects = MOCK_SUBJECTS.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Container size="xl" className="py-8">
      <Stack gap={8}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <PageHeader className="pb-0 border-0">
            <PageHeaderHeading>Subjects</PageHeaderHeading>
            <PageHeaderDescription>Manage and organize your study materials by subject.</PageHeaderDescription>
          </PageHeader>
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search subjects..." 
                className="ps-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center border rounded-md p-1 bg-muted/50 shrink-0">
              <Button 
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                size="icon-sm" 
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="icon-sm" 
                onClick={() => setViewMode('list')}
              >
                <List className="size-4" />
              </Button>
            </div>
            <Button className="shrink-0 gap-2">
              <Plus className="size-4" />
              New Subject
            </Button>
          </div>
        </div>

        {filteredSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <div className="p-4 bg-primary/10 text-primary rounded-full mb-4">
              <GraduationCap className="size-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No subjects found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {search ? "No subjects match your search query." : "You haven't created any subjects yet. Create your first subject to start organizing your notes."}
            </p>
            <Button className="gap-2">
              <Plus className="size-4" />
              Create Subject
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <Grid cols={1} gap={6}>
            {filteredSubjects.map(subject => {
              const Icon = ICON_MAP[subject.icon] || GraduationCap;
              const colorClass = COLOR_MAP[subject.color] || 'text-muted-foreground bg-muted';
              
              return (
                <Card key={subject.id} className="group hover:border-primary/50 transition-colors flex flex-col">
                  <div className="p-6 flex-1 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-lg ${colorClass}`}>
                        <Icon className="size-6" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="size-4" />
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Rename Subject</DropdownMenuItem>
                          <DropdownMenuItem>Change Color</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete Subject</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold line-clamp-1" title={subject.name}>{subject.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{subject.documentCount} documents</p>
                    </div>
                  </div>
                  <div className="px-6 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
                    Last accessed {formatDate(subject.lastAccessed, locale)}
                  </div>
                </Card>
              );
            })}
          </Grid>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSubjects.map(subject => {
              const Icon = ICON_MAP[subject.icon] || GraduationCap;
              const colorClass = COLOR_MAP[subject.color] || 'text-muted-foreground bg-muted';
              
              return (
                <Card key={subject.id} className="p-4 group hover:border-primary/50 transition-colors flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${colorClass}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold line-clamp-1">{subject.name}</h3>
                    <p className="text-sm text-muted-foreground">{subject.documentCount} documents</p>
                  </div>
                  <div className="hidden md:block text-sm text-muted-foreground px-4">
                    Accessed {formatDate(subject.lastAccessed, locale)}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Rename Subject</DropdownMenuItem>
                      <DropdownMenuItem>Change Color</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete Subject</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Card>
              );
            })}
          </div>
        )}
      </Stack>
    </Container>
  );
}

