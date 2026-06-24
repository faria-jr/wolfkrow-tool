'use client';

import { useCallback, useEffect, useState } from 'react';

import { AuditRunForm } from '@/components/audit/audit-run-form';
import { FindingsTable, type Finding } from '@/components/audit/findings-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Scan {
  id: string;
  projectPath: string;
  status: string;
  findingCount: number;
  summary?: { total: number };
  startedAt: string;
}

function ScansCard({ scans, onSelect }: { scans: Scan[]; onSelect: (s: Scan) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scans</CardTitle>
      </CardHeader>
      <CardContent>
        {scans.length === 0 ? (
          <p className="text-muted-foreground">No scans yet.</p>
        ) : (
          <ul className="space-y-2">
            {scans.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{s.projectPath}</p>
                  <p className="text-xs text-muted-foreground">{s.status} · {s.summary?.total ?? 0} findings</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { onSelect(s); }}>
                  View
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function FindingsCard({ scan, findings }: { scan: Scan; findings: Finding[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Findings for {scan.projectPath}</CardTitle>
      </CardHeader>
      <CardContent>
        <FindingsTable findings={findings} />
      </CardContent>
    </Card>
  );
}

function useAudit() {
  const [loading, setLoading] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);

  const loadScans = useCallback(async () => {
    const res = await fetch('/api/audit');
    if (!res.ok) return;
    setScans((await res.json()) as Scan[]);
  }, []);

  useEffect(() => {
    void loadScans();
  }, [loadScans]);

  const loadFindings = async (scanId: string) => {
    const res = await fetch(`/api/audit?scanId=${scanId}&type=findings`);
    if (!res.ok) return;
    const data = (await res.json()) as { findings: Finding[] };
    setFindings(data.findings);
  };

  const select = (s: Scan) => {
    setSelectedScan(s);
    void loadFindings(s.id);
  };

  const run = async (projectPath: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath }),
      });
      if (!res.ok) throw new Error('Audit failed');
      const result = (await res.json()) as Scan;
      setSelectedScan(result);
      await loadScans();
      if (result.id) await loadFindings(result.id);
    } finally {
      setLoading(false);
    }
  };

  return { loading, scans, selectedScan, findings, select, run };
}

export default function AuditPage() {
  const { loading, scans, selectedScan, findings, select, run } = useAudit();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Security Audit</h1>
      <Card>
        <CardHeader>
          <CardTitle>Run new audit</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditRunForm onRun={run} loading={loading} />
        </CardContent>
      </Card>

      <ScansCard scans={scans} onSelect={select} />

      {selectedScan && <FindingsCard scan={selectedScan} findings={findings} />}
    </div>
  );
}
