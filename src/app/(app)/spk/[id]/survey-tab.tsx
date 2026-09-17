import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  const jointCheckDone = !!spk?.joint_check_date
  const surveyComplete = surveyDone && jointCheckDone
  const currentLabel = surveyComplete
    ? 'Pengecekan Bersama'
    : surveyDone
      ? 'Pengecekan Bersama'
      : 'Survei Terestris'

  const steps: ChainStep[] = [
    {
      key: 'terrain',
      label: 'Survei Terestris',
      state: surveyDone ? 'done' : 'current',
      badge: chainBadge(surveyDone ? 'done' : 'current'),
      sub: surveyDone ? (
        <div>
          {marker?.full_name && <div>{marker.full_name}</div>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-md bg-success/10 px-2 py-0.5 font-bold text-success">
              Selesai {formatDate(spk!.terrain_survey_completed_at)}
            </span>
          </div>
        </div>
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
      ),
      sub: spk?.joint_check_date ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-success/10 px-2 py-0.5 font-bold text-success">
            Selesai {formatDate(spk.joint_check_date)}
          </span>
        </div>
      ) : surveyDone ? 'Siap dijadwalkan.' : 'Menunggu survei terestris selesai.',
      action: mayEdit ? <JointCheckDateRow spkId={spkId} date={spk?.joint_check_date ?? null} /> : undefined,
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader>
          <div>
            <CardTitle>Survei Lapangan</CardTitle>
            <CardDescription>
              {surveyComplete ? 'Selesai' : `Sedang di ${currentLabel}`}
            </CardDescription>
          </div>
          <Badge tone={surveyComplete ? 'success' : surveyDone ? 'primary' : 'neutral'}>
            {surveyComplete ? 'Selesai' : surveyDone ? 'Sedang Berjalan' : 'Draft'}
          </Badge>
      </CardHeader>
      <CardContent>
        <StepChain steps={steps} />
      </CardContent>
    </Card>
  )
}
