import React from 'react';
import { useSecurity } from '../security-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';

export const AuditTimeline: React.FC = () => {
  const { audits } = useSecurity();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Stream</CardTitle>
      </CardHeader>
      <CardContent>
        {audits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent audits.</p>
        ) : (
          <div className="space-y-4">
            {audits.map(a => (
              <div key={a.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                <span><span className="font-medium">{a.actorId}</span> {a.action} {a.resource}</span>
                <span className={a.result === 'Permit' ? 'text-green-500' : 'text-red-500'}>{a.result}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const CompliancePanel: React.FC = () => {
  const { compliance } = useSecurity();
  return (
    <Card>
      <CardHeader><CardTitle>Compliance Status</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Privacy Flags</span><span className="font-medium">{compliance.flagsActive} Active</span></div>
          <div className="flex justify-between"><span>Retention Rules</span><span className="font-medium">{compliance.rulesActive} Active</span></div>
        </div>
      </CardContent>
    </Card>
  );
};
