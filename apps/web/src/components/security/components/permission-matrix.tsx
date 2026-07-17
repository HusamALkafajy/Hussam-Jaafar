import React from 'react';
import { useSecurity } from '../security-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { Shield, Lock, FileText, CheckCircle } from 'lucide-react';

export const PermissionMatrix: React.FC = () => {
  const { context } = useSecurity();

  if (!context) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><Lock className="mr-2 h-5 w-5" /> Active Permissions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {context.permissions.map(p => (
            <span key={p} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium">
              {p}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
