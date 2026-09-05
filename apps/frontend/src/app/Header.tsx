import { useDataManagerKeys } from '@genshin-optimizer/common/database-ui'
import {
  CloudSyncStatusChip,
  useCloudSync,
} from '@genshin-optimizer/common/gdrive-ui'
import { AnvilIcon } from '@genshin-optimizer/common/svgicons'
import { Tally } from '@genshin-optimizer/common/ui'
import { shouldShowDevComponents } from '@genshin-optimizer/common/util'
import { useDatabase, useDBMeta } from '@genshin-optimizer/gi/db-ui'
import { FlowerIcon } from '@genshin-optimizer/gi/svgicons'
import { SillyContext } from '@genshin-optimizer/gi/ui'
import ArticleIcon from '@mui/icons-material/Article'
import BookIcon from '@mui/icons-material/Book'
import ConstructionIcon from '@mui/icons-material/Construction'
import GroupsIcon from '@mui/icons-material/Groups'
import MenuIcon from '@mui/icons-material/Menu'
import PeopleIcon from '@mui/icons-material/People'
import ScannerIcon from '@mui/icons-material/Scanner'
import SettingsIcon from '@mui/icons-material/Settings'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Skeleton,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import type { ReactElement, ReactNode } from 'react'
import { Suspense, useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useMatch } from 'react-router-dom'
import go_icon from './go_icon.png'
import silly_icon from './silly_icon.png'

type ITab = {
  i18Key: string
  icon: ReactNode
  to: string
  value: string
  textSuffix?: ReactNode
}
const artifacts: ITab = {
  i18Key: 'tabs.artifacts',
  icon: <FlowerIcon />,
  to: '/artifacts',
  value: 'artifacts',
  textSuffix: <ArtifactChip key="weaponAdd" />,
}
const weapons: ITab = {
  i18Key: 'tabs.weapons',
  icon: <AnvilIcon />,
  to: '/weapons',
  value: 'weapons',
  textSuffix: <WeaponChip key="weaponAdd" />,
}
const archive: ITab = {
  i18Key: 'tabs.archive',
  icon: <BookIcon />,
  to: '/archive',
  value: 'archive',
}
const characters: ITab = {
  i18Key: 'tabs.characters',
  icon: <PeopleIcon />,
  to: '/characters',
  value: 'characters',
  textSuffix: <CharacterChip key="charAdd" />,
}
const teams: ITab = {
  i18Key: 'tabs.teams',
  icon: <GroupsIcon />,
  to: '/teams',
  value: 'teams',
  textSuffix: <TeamChip key="charAdd" />,
}
const tools: ITab = {
  i18Key: 'tabs.tools',
  icon: <ConstructionIcon />,
  to: '/tools',
  value: 'tools',
}
const scanner: ITab = {
  i18Key: 'tabs.scanner',
  icon: <ScannerIcon />,
  to: '/scanner',
  value: 'scanner',
}
const doc: ITab = {
  i18Key: 'tabs.doc',
  icon: <ArticleIcon />,
  to: '/doc',
  value: 'doc',
}
const setting: ITab = {
  i18Key: 'tabs.setting',
  icon: <SettingsIcon />,
  to: '/setting',
  value: 'setting',
  textSuffix: <DBChip />,
}

function DBChip() {
  const { name } = useDBMeta()
  return <Chip label={name} />
}

function ArtifactChip() {
  const database = useDatabase()
  return <Tally>{useDataManagerKeys(database.arts).length}</Tally>
}
function CharacterChip() {
  const database = useDatabase()
  return <Tally>{useDataManagerKeys(database.chars).length}</Tally>
}
function TeamChip() {
  const database = useDatabase()
  return <Tally>{useDataManagerKeys(database.teams).length}</Tally>
}
function WeaponChip() {
  const database = useDatabase()
  return <Tally>{useDataManagerKeys(database.weapons).length}</Tally>
}

export default function Header({ anchor }: { anchor: string }) {
  return (
    <Suspense fallback={<Skeleton variant="rectangular" height={56} />}>
      <HeaderContent anchor={anchor} />
    </Suspense>
  )
}

const maincontent = [
  artifacts,
  weapons,
  characters,
  teams,
  archive,
  tools,
  scanner,
  doc,
  setting,
] as const
function HeaderContent({ anchor }: { anchor: string }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const {
    params: { currentTab },
  } = useMatch({ path: '/:currentTab', end: false }) ?? {
    params: { currentTab: '' },
  }
  if (isMobile)
    return <MobileHeader anchor={anchor} currentTab={currentTab ?? ''} />
  return <DesktopHeader anchor={anchor} currentTab={currentTab ?? ''} />
}
function HeaderSyncChipWrapper(props: {
  children?: ReactNode
  onChange?: unknown
  onFocus?: unknown
  selected?: unknown
  value?: unknown
}) {
  const { onChange, onFocus, selected, value, children, ...rest } = props
  return (
    <Box
      sx={{
        ml: 'auto',
        display: 'flex',
        alignItems: 'center',
        mr: 1,
      }}
      {...rest}
    >
      {children}
    </Box>
  )
}

function DesktopHeader({
  anchor,
  currentTab,
}: {
  anchor: string
  currentTab: string
}) {
  const theme = useTheme()
  const isXL = useMediaQuery(theme.breakpoints.up('xl'))
  const { t } = useTranslation(['ui', 'settings'])
  const { silly } = useContext(SillyContext)
  const { session } = useCloudSync()

  const syncLabels = useMemo(
    () => ({
      IDLE: t('settings:cloudSync.status.idle'),
      SYNCING: t('settings:cloudSync.status.syncing'),
      DEBOUNCING: t('settings:cloudSync.status.debouncing'),
      CONFLICT: t('settings:cloudSync.status.conflict'),
      ERROR: t('settings:cloudSync.status.error'),
    }),
    [t]
  )

  return (
    <AppBar
      position="static"
      sx={{ bgcolor: 'neutral900.main' }}
      elevation={0}
      id={anchor}
    >
      <Tabs
        value={currentTab}
        sx={(theme) => ({
          '& .MuiTab-root': {
            p: 1,
            minWidth: 'auto',
            minHeight: 'auto',
          },
          '& .MuiTab-root:hover': {
            transition: 'background-color 0.5s ease',
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
          '& .Mui-selected': {
            backgroundImage: `linear-gradient(to top, ${theme.palette.brand500.main}, ${theme.palette.neutral700.main})`,
            color: `${theme.palette.neutral100.main} !important`,
            textShadow:
              '0.25px 0 0 currentColor, -0.25px 0 0 currentColor, 0 0.25px 0 currentColor, 0 -0.25px 0',
          },
        })}
      >
        <Tab
          value=""
          component={RouterLink}
          to="/"
          label={
            <Box display="flex" alignItems="center">
              <Avatar
                src={silly ? silly_icon : go_icon}
                variant="rounded"
                sx={(theme) => ({
                  height: '24px',
                  width: '24px',
                  boxShadow: `0 0 10px 1px ${theme.palette.brand500.main}`,
                })}
              />
              <Typography variant="h6" sx={{ px: 1, fontWeight: 'Normal' }}>
                {t(silly ? 'sillyPageTitle' : 'pageTitle')}
              </Typography>
              {shouldShowDevComponents && (
                <Typography variant="body1">(Dev Mode)</Typography>
              )}
            </Box>
          }
        />
        {maincontent.map(({ i18Key, value, to, icon, textSuffix }) => {
          const tooltipIcon = isXL ? (
            icon
          ) : (
            <Tooltip key={value} arrow title={t(i18Key)}>
              {icon as JSX.Element}
            </Tooltip>
          )
          const isSetting = value === 'setting'
          const tab = (
            <Tab
              key={value}
              value={value}
              component={RouterLink}
              to={to}
              icon={tooltipIcon as ReactElement}
              iconPosition="start"
              label={
                isXL || textSuffix ? (
                  <Box display="flex" gap={0.5} alignItems="center">
                    {isXL && <Typography>{t(i18Key)}</Typography>}
                    {textSuffix}
                  </Box>
                ) : undefined
              }
              sx={{ ml: isSetting && !session ? 'auto' : undefined }}
            />
          )

          if (isSetting && session) {
            return [
              <HeaderSyncChipWrapper key="cloud-sync-chip">
                <CloudSyncStatusChip
                  component={RouterLink}
                  to="/setting"
                  clickable
                  labels={syncLabels}
                />
              </HeaderSyncChipWrapper>,
              tab,
            ]
          }

          return tab
        })}
      </Tabs>
    </AppBar>
  )
}

const mobileContent = [
  artifacts,
  weapons,
  characters,
  teams,
  archive,
  tools,
  scanner,
  doc,
  setting,
] as const
function MobileHeader({
  anchor,
  currentTab,
}: {
  anchor: string
  currentTab: string
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const { t } = useTranslation(['ui', 'settings'])
  const { silly } = useContext(SillyContext)
  const { session } = useCloudSync()

  const syncLabels = useMemo(
    () => ({
      IDLE: t('settings:cloudSync.status.idle'),
      SYNCING: t('settings:cloudSync.status.syncing'),
      DEBOUNCING: t('settings:cloudSync.status.debouncing'),
      CONFLICT: t('settings:cloudSync.status.conflict'),
      ERROR: t('settings:cloudSync.status.error'),
    }),
    [t]
  )
  return (
    <>
      <AppBar
        position="fixed"
        sx={{ bgcolor: 'neutral900.main' }}
        elevation={0}
      >
        <Drawer
          anchor="right"
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          PaperProps={{
            sx: (theme) => ({
              // backgroundColor: 'neutral700.main',
              backgroundImage: `linear-gradient(to right, ${theme.palette.neutral700.main}, ${theme.palette.neutral700.main})`,
            }),
          }}
        >
          <Tabs
            value={currentTab}
            orientation="vertical"
            variant="scrollable"
            scrollButtons={false}
            TabIndicatorProps={{
              sx: {
                left: 0,
                width: '4px',
              },
            }}
            sx={(theme) => ({
              '& .Mui-selected': {
                backgroundImage: `linear-gradient(to right, ${theme.palette.brand500.main}, ${theme.palette.neutral700.main})`,
                color: `${theme.palette.neutral100.main} !important`,
                textShadow:
                  '0.1px 0 0 currentColor, -0.1px 0 0 currentColor, 0 0.1px 0 currentColor, 0 -0.1px 0',
              },
            })}
          >
            <Tab
              value=""
              component={RouterLink}
              to={'/'}
              onClick={handleDrawerToggle}
              icon={
                <Avatar
                  src={silly ? silly_icon : go_icon}
                  variant="rounded"
                  sx={(theme) => ({
                    height: '24px',
                    width: '24px',
                    boxShadow: `0 0 10px 1px ${theme.palette.brand500.main}`,
                  })}
                />
              }
              iconPosition="start"
              label={
                <Typography>
                  {silly ? t('sillyPageTitle') : t('pageTitle')}
                </Typography>
              }
            />
            {mobileContent.map(({ i18Key, value, to, icon, textSuffix }) => (
              <Tab
                key={value}
                value={value}
                component={RouterLink}
                to={to}
                onClick={handleDrawerToggle}
                icon={icon as ReactElement}
                iconPosition="start"
                label={
                  <Box display="flex" gap={0.5} alignItems="center">
                    <Typography>{t(i18Key)}</Typography>
                    {textSuffix}
                  </Box>
                }
                sx={{ justifyContent: 'flex-start' }}
              />
            ))}
          </Tabs>
        </Drawer>
        <Toolbar>
          <Button
            variant="text"
            sx={(theme) => ({
              color: `${theme.palette.neutral200.main} !important`,
            })}
            component={RouterLink}
            to="/"
            startIcon={
              <Avatar
                src={silly ? silly_icon : go_icon}
                variant="rounded"
                sx={(theme) => ({
                  height: '24px',
                  width: '24px',
                  boxShadow: `0 0 10px 1px ${theme.palette.brand500.main}`,
                })}
              />
            }
          >
            <Typography variant="h6" noWrap component="div" sx={{ px: 1 }}>
              {silly ? t('sillyPageTitle') : t('pageTitle')}
            </Typography>
            {shouldShowDevComponents ? (
              <Typography variant="body1">(Dev Mode)</Typography>
            ) : undefined}
          </Button>
          <Box flexGrow={1} />
          {session && (
            <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
              <CloudSyncStatusChip
                component={RouterLink}
                to="/setting"
                clickable
                labels={syncLabels}
              />
            </Box>
          )}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="end"
            onClick={handleDrawerToggle}
            size="large"
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      {/* add a blank toolbar to keep space and provide a scroll anchor */}
      <Toolbar id={anchor} />
    </>
  )
}
