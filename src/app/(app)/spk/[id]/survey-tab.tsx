import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { markTerrainSurvey, unmarkTerrainSurvey } from '../actions'
import { OpnamePadRow } from './opname-pad-mark'
import { JointCheckDateRow } from './joint-check-date'

/** Survei Lapangan — the field-survey stage before design/routing takes over:
 *  Survei Terestris (On Going/Selesai mark) and Pengecekan Bersama (date). */
export async function SurveyTab({ spkId, mayEdit }: { spkId: string; mayEdit: boolean }) {
  const supabase = await createClient()

  const { data: spk } = await supabase
    .from('spks')
    .select('terrain_survey_completed_at, terrain_survey_marked_by, joint_check_date')
    .eq('id', spkId)
    .maybeSingle()

  const { data: marker } = spk?.terrain_survey_marked_by
    ? await supabase.from('users').select('full_name').eq('id', spk.terrain_survey_marked_by).maybeSingle()
    : { data: null }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survei Lapangan</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-slate-100 py-0">
        {mayEdit ? (
          <>
            <OpnamePadRow
              label="Survei Terestris"
              spkId={spkId}
              markedAt={spk?.terrain_survey_completed_at ?? null}
              markedByName={marker?.full_name ?? null}
              markAction={markTerrainSurvey}
              unmarkAction={unmarkTerrainSurvey}
              doneLabel="Selesai"
              pendingLabel="On Going"
            />
            <JointCheckDateRow spkId={spkId} date={spk?.joint_check_date ?? null} />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm font-bold text-slate-900">Survei Terestris</span>
              <Badge tone={spk?.terrain_survey_completed_at ? 'success' : 'neutral'}>
                {spk?.terrain_survey_completed_at ? 'Selesai' : 'On Going'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm font-bold text-slate-900">Pengecekan Bersama</span>
              <span className="tnum text-sm text-muted-foreground">
                {spk?.joint_check_date ? formatDate(spk.joint_check_date) : '—'}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
