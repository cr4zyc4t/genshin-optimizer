import { objKeyMap, range } from '@genshin-optimizer/common/util'
import type { WeaponKey } from '@genshin-optimizer/gi/consts'
import {
  input,
  lookup,
  naught,
  prod,
  subscript,
} from '@genshin-optimizer/gi/wr'
import { cond, st, stg, trans } from '../../../SheetUtil'
import type { IWeaponSheet } from '../../IWeaponSheet'
import { dataObjForWeaponSheet } from '../../util'
import { headerTemplate, WeaponSheet } from '../../WeaponSheet'

const key: WeaponKey = 'SilverLight'
const [, trm] = trans('weapon', key)

// Elemental Mastery per stack, refinement-scaled
// R1: 52, R2: 65, R3: 78, R4: 91, R5: 104
const eleMas_arr = [-1, 52, 65, 78, 91, 104]
const skillStacksArr = range(1, 2)
const [condSkillStacksPath, condSkillStacks] = cond(key, 'skillStacks')
const eleMas = lookup(
  condSkillStacks,
  objKeyMap(skillStacksArr, (stack) =>
    prod(subscript(input.weapon.refinement, eleMas_arr), stack)
  ),
  naught
)

const data = dataObjForWeaponSheet(key, {
  premod: {
    eleMas,
  },
})

const sheet: IWeaponSheet = {
  document: [
    {
      header: headerTemplate(key, st('stacks')),
      path: condSkillStacksPath,
      value: condSkillStacks,
      name: trm('afterEleSkill'),
      states: objKeyMap(skillStacksArr, (stack) => ({
        name: st('stack', { count: stack }),
        fields: [
          {
            node: eleMas,
          },
          {
            text: stg('duration'),
            value: 12,
            unit: 's',
          },
        ],
      })),
    },
  ],
}
export default new WeaponSheet(sheet, data)
