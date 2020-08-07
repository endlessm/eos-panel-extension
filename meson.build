project('eos-panel-extension',
  version: '0.1',
  meson_version: '>= 0.40.0'
)

sources = [
  'extension.js',
  'utils.js',
]
ui_sources = [
  'ui/appIconBar.js',
  'ui/endlessButton.js',
  'ui/hotCorner.js',
  'ui/layout.js',
  'ui/overview.js',
  'ui/panel.js',
  'ui/panelManager.js',
  'ui/panelMenu.js',
  'ui/power.js',
  'ui/powerButton.js',
  'ui/systemMenu.js',
  'ui/userMenu.js',
  'ui/workspaceMonitor.js',
]
icons = [
  'data/icons/endless-button-symbolic.svg',
  'data/icons/endless-help-symbolic.svg',
  'data/icons/feedback-symbolic.svg',
  'data/icons/hot-corner-symbolic.svg',
  'data/icons/hot-corner-rtl-symbolic.svg',
]
extra_data = [
  'COPYING',
]
schemas = [
  'com.endlessm.panel-extension',
]

uuid = 'eos-panel@endlessm.com'

datadir = get_option('datadir')
extensiondir = join_paths(datadir, 'gnome-shell', 'extensions', uuid)
schemadir = join_paths(extensiondir, 'schemas')
uidir = join_paths(extensiondir, 'ui')
iconsdir = join_paths(extensiondir, 'data', 'icons')

metaconf = configuration_data()
metaconf.set('uuid', uuid)
metaconf.set('settings_schema', schemas[0])
meta = [
  configure_file(
    input: 'metadata.json.in',
    output: 'metadata.json',
    configuration: metaconf
  )
]

install_data(sources,
  install_dir: extensiondir
)

install_data(ui_sources,
  install_dir: uidir
)

install_data(icons,
  install_dir: iconsdir
)

install_data(extra_data,
  install_dir: extensiondir
)

install_data(meta,
  install_dir: extensiondir
)

foreach s : schemas
  install_data('schemas/@0@.gschema.xml'.format(s),
    install_dir: schemadir
  )
endforeach

glib_compile = find_program('glib-compile-schemas', required: true)
meson.add_install_script('meson-postinstall.sh', schemadir)

sassc = find_program('sassc', required: true)
sassc_opts = [ '-a', '-M', '-t', 'compact' ]
styles = custom_target('styles',
  input: 'stylesheet.scss',
  output: 'stylesheet.css',
  command: [
    sassc, sassc_opts, '@INPUT@', '@OUTPUT@',
  ],
  depend_files: 'stylesheet.scss',
  install: true,
  install_dir: extensiondir,
  build_by_default: true
)
