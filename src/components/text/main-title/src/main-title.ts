import { DatavComponent } from '@/components/datav-component'
import {
  ApiConfigMap, ApiDataConfigMap,
  setApiConfig, setApiData,
} from '@/components/data-source'
import { createField } from '@/components/data-field'
import { DataEventConfig } from '@/components/data-event'

/**
 * MainTitle
 */
export class MainTitle extends DatavComponent {
  config = {
    title: '我是标题数据',
    textStyle: {
      fontFamily: 'Microsoft Yahei',
      fontSize: 24,
      color: '#fff',
      fontWeight: 'normal',
    },
    textAlign: 'center',
    writingMode: 'horizontal-tb',
    letterSpacing: 0,
    backgroundStyle: {
      show: false,
      bgColor: '#008bff',
      borderRadius: 15,
      borderColor: '#fff',
      borderStyle: 'solid',
      borderWidth: 1,
    },
    ellipsis: false,
    urlConfig: {
      url: '',
      isBlank: false,
    },
  }

  apis: ApiConfigMap
  apiData: ApiDataConfigMap

  events: Record<string, DataEventConfig>

  actions: Record<string, DataEventConfig>

  constructor() {
    super('MainTitle', { w: 300, h: 56 })

    this.initData()
  }

  initData() {
    const fields = [
      createField('title', { description: '标题值', optional: true }),
      createField('url', { description: '超链接', optional: true }),
    ]

    this.apis = setApiConfig({}, 'source', {
      fields: Object.assign({}, ...fields),
    })

    this.apiData = setApiData(this.id, {}, 'source', {
      title: '我是标题数据',
      url: '',
    })

    this.events = {}

    this.actions = {}

    return this
  }
}

export default MainTitle
