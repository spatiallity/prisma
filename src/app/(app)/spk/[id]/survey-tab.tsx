import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StepChain, chainBadge, type ChainStep } from '@/components/ui/step-chain'
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

  const surveyDone = !!spk?.terrain_survey_completed_at

  const steps: ChainStep[] = [
    {
      key: 'terrain',
      label: 'Survei Terestris',
      state: surveyDone ? 'done' : 'current',
      badge: chainBadge(surveyDone ? 'done' : 'current'),
      sub: surveyDone ? (
        <>
          {formatDate(spk!.terrain_survey_completed_at)}
          {marker?.full_name && ` · ${marker.full_name}`}
        </>
      ) : undefined,
      action: mayEdit ? (
        <OpnamePadRow
          label="Survei Terestris"
          spkId={spkId}
          markedAt={spk?.terrain_survey_completed_at ?? null}
          markAction={markTerrainSurvey}
          unmarkAction={unmarkTerrainSurvey}
        />
      ) : undefined,
    },
    {
      key: 'joint_check',
      label: 'Pengecekan Bersama',
      state: spk?.joint_check_date ? 'done' : surveyDone ? 'current' : 'pending',
      badge: chainBadge(
        spk?.joint_check_date ? 'done' : surveyDone ? 'current' : 'pending',
        spk?.joint_check_date ? formatDate(spk.joint_check_date) : 'Belum dijadwalkan',
      ),
      action: mayEdit ? <JointCheckDateRow spkId={spkId} date={spk?.joint_check_date ?? null} /> : undefined,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survei Lapangan</CardTitle>
      </CardHeader>
      <CardContent>
        <StepChain steps={steps} />
      </CardContent>
    </Card>
  )
}
