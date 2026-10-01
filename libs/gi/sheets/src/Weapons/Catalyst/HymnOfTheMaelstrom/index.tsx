import { objKeyMap, range } from '@genshin-optimizer/common/util'
import type { WeaponKey } from '@genshin-optimizer/gi/consts'
import {
  equal,
  equalStr,
  infoMut,
  input,
  lookup,
  max,
  min,
  naught,
  prod,
  subscript,
  sum,
  target,
} from '@genshin-optimizer/gi/wr'
import { cond, nonStackBuff, st, stg, trans } from '../../../SheetUtil'
import type { IWeaponSheet } from '../../IWeaponSheet'
import { dataObjForWeaponSheet } from '../../util'
import { headerTemplate, WeaponSheet } from '../../WeaponSheet'

const key: WeaponKey = 'HymnOfTheMaelstrom'
const [, trm] = trans('weapon', key)

const heal_arr = [-1, 0.04, 0.05, 0.06, 0.07, 0.08]
const hp_arr = [-1, 0.04, 0.05, 0.06, 0.07, 0.08]
const atkPer1k_arr = [-1, 0.004, 0.005, 0.006, 0.007, 0.008]
const maxAtk_arr = [-1, 0.08, 0.1, 0.12, 0.14, 0.16]

const heal_ = subscript(input.weapon.refinement, heal_arr)

const vintageStacksArr = range(1, 3)
const [condVintagePath, condVintage] = cond(key, 'vintage')
const [condBoostPath, condBoost] = cond(key, 'boost')

const boostMult = sum(1, equal(condBoost, 'on', 0.75))

const hp_ = prod(
  lookup(
    condVintage,
    objKeyMap(vintageStacksArr, (stack) =>
      prod(stack, subscript(input.weapon.refinement, hp_arr))
    ),
    naught
  ),
  boostMult
)

const hpOver1k = max(0, prod(sum(input.total.hp, -40000), 1 / 1000))
const baseAtk_ = min(
  subscript(input.weapon.refinement, maxAtk_arr),
  prod(subscript(input.weapon.refinement, atkPer1k_arr), hpOver1k)
)

const atkBoost = prod(
  lookup(
    condVintage,
    objKeyMap(vintageStacksArr, (stack) => prod(stack, baseAtk_)),
    naught
  ),
  boostMult
)

const nonstackWrite = equalStr(condVintage, '1', input.charKey)
const [atk_disp, atk_dispinactive] = nonStackBuff('hymn', 'atk_', atkBoost)
const teamAtk_ = equal(input.activeCharKey, target.charKey, atk_disp)

const data = dataObjForWeaponSheet(key, {
  premod: {
    heal_,
    hp_,
  },
  teamBuff: {
    premod: {
      atk_: teamAtk_,
    },
    nonStacking: {
      hymn: nonstackWrite,
    },
  },
})

const sheet: IWeaponSheet = {
  document: [
    {
      header: headerTemplate(key, st('base')),
      fields: [{ node: heal_ }],
    },
    {
      value: condVintage,
      path: condVintagePath,
      teamBuff: true,
      header: headerTemplate(key, st('stacks')),
      name: trm('vintage'),
      states: Object.fromEntries(
        vintageStacksArr.map((c) => [
          c,
          {
            name: st('stack', { count: c }),
            fields: [
              { node: hp_ },
              {
                node: infoMut(atk_disp, {
                  path: 'atk_',
                  isTeamBuff: true,
                }),
              },
              { node: atk_dispinactive },
              {
                text: stg('duration'),
                value: 10,
                unit: 's',
              },
            ],
          },
        ])
      ),
    },
    {
      value: condBoost,
      path: condBoostPath,
      teamBuff: true,
      header: headerTemplate(key, st('conditional')),
      name: trm('boost'),
      states: {
        on: {
          fields: [
            {
              text: stg('duration'),
              value: 5,
              unit: 's',
            },
          ],
        },
      },
    },
  ],
}
export default new WeaponSheet(sheet, data)
