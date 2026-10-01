import { objKeyValMap } from '@genshin-optimizer/common/util'
import {
  allStellarReactionKeys,
  type WeaponKey,
} from '@genshin-optimizer/gi/consts'
import {
  equal,
  input,
  min,
  prod,
  subscript,
  sum,
  tally,
} from '@genshin-optimizer/gi/wr'
import { cond, st, trans } from '../../../SheetUtil'
import type { IWeaponSheet } from '../../IWeaponSheet'
import { dataObjForWeaponSheet } from '../../util'
import { headerTemplate, WeaponSheet } from '../../WeaponSheet'

const key: WeaponKey = 'WintersHeavyHeart'
const [, trm] = trans('weapon', key)

const cryoEleMas_arr = [-1, 24, 30, 36, 42, 48]
const electroAtk_arr = [-1, 0.048, 0.06, 0.072, 0.084, 0.096]
const radianceEleMas_arr = [-1, 20, 25, 30, 35, 40]
const radianceStellarDmg_arr = [-1, 0.06, 0.075, 0.09, 0.105, 0.12]

const [condRadiancePath, condRadiance] = cond(key, 'radiance')

const cryoCount = min(tally.cryo, 4)
const electroCount = min(tally.electro, 4)
const combinedCount = min(sum(tally.cryo, tally.electro), 4)

const normalEleMas = prod(
  subscript(input.weapon.refinement, cryoEleMas_arr),
  cryoCount
)
const normalAtk_ = prod(
  subscript(input.weapon.refinement, electroAtk_arr),
  electroCount
)

const radianceEleMas = prod(
  subscript(input.weapon.refinement, radianceEleMas_arr),
  combinedCount
)
const radianceStellarDmg = prod(
  subscript(input.weapon.refinement, radianceStellarDmg_arr),
  combinedCount
)

const eleMas = sum(
  equal(condRadiance, undefined, normalEleMas),
  equal(condRadiance, 'on', radianceEleMas)
)

const atk_ = equal(condRadiance, undefined, normalAtk_)

const stellar_dmg_obj = objKeyValMap(allStellarReactionKeys, (k) => [
  `${k}_dmg_`,
  equal(condRadiance, 'on', radianceStellarDmg),
])

const data = dataObjForWeaponSheet(key, {
  premod: {
    eleMas,
    atk_,
    ...stellar_dmg_obj,
  },
})

const sheet: IWeaponSheet = {
  document: [
    {
      header: headerTemplate(key, st('base')),
      fields: [
        { node: eleMas },
        { node: atk_ },
        ...Object.values(stellar_dmg_obj).map((node) => ({ node })),
      ],
    },
    {
      value: condRadiance,
      path: condRadiancePath,
      header: headerTemplate(key, st('conditional')),
      name: trm('radiance'),
      states: {
        on: {
          fields: [
            { node: eleMas },
            ...Object.values(stellar_dmg_obj).map((node) => ({ node })),
          ],
        },
      },
    },
  ],
}
export default new WeaponSheet(sheet, data)
