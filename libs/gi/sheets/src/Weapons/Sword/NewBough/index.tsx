import { objKeyMap, objKeyValMap, range } from '@genshin-optimizer/common/util'
import {
  allStellarReactionKeys,
  type WeaponKey,
} from '@genshin-optimizer/gi/consts'
import {
  equal,
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

const key: WeaponKey = 'NewBough'
const [, trm] = trans('weapon', key)

const normalAtk_arr = [-1, 0.04, 0.05, 0.06, 0.07, 0.08]
const radianceAtk_arr = [-1, 0.06, 0.075, 0.09, 0.105, 0.12]
const eleMas_arr = [-1, 20, 25, 30, 35, 40]
const stellarDmg_arr = [-1, 0.08, 0.1, 0.12, 0.14, 0.16]

const [condVerdantPath, condVerdant] = cond(key, 'verdant')
const [condRadiancePath, condRadiance] = cond(key, 'radiance')

const verdantStacksArr = range(1, 3)

const atk_ = lookup(
  condVerdant,
  objKeyMap(verdantStacksArr, (stack) =>
    lookup(
      condRadiance,
      {
        on: prod(stack, subscript(input.weapon.refinement, radianceAtk_arr)),
      },
      prod(stack, subscript(input.weapon.refinement, normalAtk_arr))
    )
  ),
  naught
)

const eleMas = equal(
  condRadiance,
  undefined,
  lookup(
    condVerdant,
    objKeyMap(verdantStacksArr, (stack) =>
      prod(stack, subscript(input.weapon.refinement, eleMas_arr))
    ),
    naught
  )
)

const stellar_dmg_obj = objKeyValMap(allStellarReactionKeys, (k) => [
  `${k}_dmg_`,
  equal(
    condRadiance,
    'on',
    lookup(
      condVerdant,
      objKeyMap(verdantStacksArr, (stack) =>
        prod(stack, subscript(input.weapon.refinement, stellarDmg_arr))
      ),
      naught
    )
  ),
])

const data = dataObjForWeaponSheet(key, {
  premod: {
    atk_,
    eleMas,
    ...stellar_dmg_obj,
  },
})

const sheet: IWeaponSheet = {
  document: [
    {
      value: condVerdant,
      path: condVerdantPath,
      header: headerTemplate(key, st('stacks')),
      name: trm('verdant'),
      states: Object.fromEntries(
        verdantStacksArr.map((c) => [
          c,
          {
            name: st('stack', { count: c }),
            fields: [
              { node: atk_ },
              { node: eleMas },
              ...Object.values(stellar_dmg_obj).map((node) => ({ node })),
              {
                text: stg('duration'),
                value: 6,
                unit: 's',
              },
            ],
          },
        ])
      ),
    },
    {
      value: condRadiance,
      path: condRadiancePath,
      header: headerTemplate(key, st('conditional')),
      name: trm('radiance'),
      states: {
        on: {
          fields: [
            {
              text: stg('duration'),
              value: 6,
              unit: 's',
            },
          ],
        },
      },
    },
  ],
}
export default new WeaponSheet(sheet, data)
