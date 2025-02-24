import {
  VuexModule, Module, Mutation, Action, getModule, config,
} from 'vuex-module-decorators'
import { cloneDeep, debounce  } from 'lodash-es'
import store from '@/store'
import { Project, ProjectConfig } from '@/domains/project'
import { getComs, deleteCom, addCom, copyCom } from '@/api/coms'
import { getProject } from '@/api/project'
import { ComType, DatavComponent } from '@/components/datav-component'
import { MoveType } from '@/utils/enums'
import { generateId, getTextParams } from '@/utils/util'
import { calcIntersectingLines } from '@/utils/intersecting-line-util'

config.rawError = true

/* region interfaces */

export type Screen = Pick<Project, 'id' | 'name'>

interface MoveComDto {
  id: string
  moveType: MoveType
}

export interface AlignLine {
  top: number
  bottom: number
  left: number
  right: number
  vertical: number
  horizontal: number
  enable: boolean
  show: boolean
}

export interface IEditorState {
  editMode: boolean
  screen: Screen
  pageConfig: ProjectConfig
  coms: DatavComponent[]
  subComs: DatavComponent[]
  canvas: {
    scale: number
    width: number
    height: number
  }
  referLine: {
    enable: boolean
  }
  guideLine: {
    h: number[]
    v: number[]
  }
  alignLine: AlignLine
  contextMenu: {
    show: boolean
  }
  isNormalResizeMode: boolean
}

/* endregion */

const findComIndex = (coms: DatavComponent[], id: string) => {
  return coms.findIndex(c => c.id === id)
}

const findCom = (coms: DatavComponent[], id: string) => {
  return coms.find(c => c.id === id)
}

const findComs = (coms: DatavComponent[], parentId?: string) => {
  return coms.filter(c => c.parentId === parentId)
}

const selectCom = (coms: DatavComponent[], id?: string) => {
  coms.forEach(com => {
    if (com.id === id) {
      com.selected = true
    } else {
      com.selected = false
    }
    com.hovered = false
  })
}



@Module({ dynamic: true, store, name: 'editor' })
class Editor extends VuexModule implements IEditorState {
  editMode = false

  screen = {
    id: 0,
    name: '',
  }

  pageConfig: ProjectConfig = {
    width: 1920,
    height: 1080,
    bgimage: '',
    bgcolor: '',
    grid: 8,
    screenshot: '',
    zoomMode: 0,
    useWatermark: false,
    styleFilterParams: {
      enable: false,
      hue: 0,
      saturate: 100,
      brightness: 100,
      contrast: 100,
      opacity: 100,
    },
    flow: {},
    variables: {
      componentsView: {},
      publishersView: {},
      subscribersView: {},
    },
  }

  coms: DatavComponent[] = [];
  subComs: DatavComponent[] = [];

  canvas = {
    scale: 0.2,
    width: 1920,
    height: 1080,
  }

  referLine = {
    enable: true,
  }

  guideLine: {
    h: number[]
    v: number[]
  } = {
    h: [],
    v: [],
  }

  alignLine = {
    enable: false,
    show: false,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    vertical: 0,
    horizontal: 0,
  }

  contextMenu = {
    show: false,
  }

  isNormalResizeMode = true

  public get selectedCom() {
    return this.coms.find(m => m.selected)
  }

  @Mutation
  public SET_SCREEN(payload: Project) {
    this.screen = {
      id: payload.id,
      name: payload.name,
    }

    this.pageConfig = { ...payload.config }
  }

  @Mutation
  public SET_COMS(payload: DatavComponent[]) {
    const coms: DatavComponent[] = []
    const subComs: DatavComponent[] = []
    payload.forEach(c => {
      if (c.type === ComType.com) {
        coms.push(c)
      } else if (c.type === ComType.subCom) {
        subComs.push(c)
      }
    })

    this.coms = coms
    this.subComs = subComs
  }

  @Mutation
  private SET_CANVAS(payload: { scale: number; width: number; height: number; }) {
    this.canvas = { ...payload }
  }

  /**
   * 计算对齐线
   */
  @Mutation
  public calcAlignLine(com: DatavComponent) {
    if (!this.alignLine.enable) {
      return
    }

    const attr = calcIntersectingLines(com, this.coms, this.canvas.scale)
    this.alignLine = { ...this.alignLine, ...attr, show: true }
  }

  /**
   * 隐藏对齐线
   */
  @Mutation
  public hideAlignLine(id?: string) {
    if (!this.alignLine.enable) {
      return
    }

    if (this.alignLine.enable && this.alignLine.show) {
      this.alignLine.show = false
      selectCom(this.coms, id)
    }
  }

  @Mutation
  public moveCom({ id, moveType }: MoveComDto) {
    const i = findComIndex(this.coms, id)
    if (moveType === MoveType.up) {
      if (i + 1 < this.coms.length) {
        this.coms.splice(i + 1, 0, ...this.coms.splice(i, 1))
      }
    } else if (moveType === MoveType.down) {
      if (i > 0) {
        this.coms.splice(i - 1, 0, ...this.coms.splice(i, 1))
      }
    } else if (moveType === MoveType.top) {
      if (i + 1 < this.coms.length) {
        this.coms.push(...this.coms.splice(i, 1))
      }
    } else if (moveType === MoveType.bottom) {
      if (i > 0) {
        this.coms.unshift(...this.coms.splice(i, 1))
      }
    }
  }

  @Mutation
  public selectCom(id?: string) {
    selectCom(this.coms, id)
  }

  @Mutation
  public setEditMode() {
    this.editMode = true
  }

  @Mutation
  public changeResizeMode(isNormal: boolean) {
    this.isNormalResizeMode = isNormal
  }

  @Mutation
  public setPublishersView(payload: { id: string; keys: string[]; enable: boolean; }) {
    const { id, keys, enable } = payload
    const pv = this.pageConfig.variables.publishersView
    const pvkeys = Object.keys(pv)
    const allKeys = new Set([...keys, ...pvkeys])
    allKeys.forEach(key => {
      if (enable) {
        if (!pvkeys.includes(key)) {
          pv[key] = [id]
        } else if (!pv[key].includes(id)) {
          pv[key].push(id)
        } else if (!keys.includes(key)) {
          pv[key] = pv[key].filter(m => m !== id)
        }
      } else {
        if (pvkeys.includes(key)) {
          pv[key] = pv[key].filter(m => m !== id)
        }
      }

      if (pv[key].length === 0) {
        delete pv[key]
      }
    })
  }

  @Mutation
  public setSubscribersView(payload: { id: string; data: string; }) {
    const { id, data } = payload
    const sv = this.pageConfig.variables.subscribersView
    const keys = getTextParams(data).map(m => m.substr(1))
    const svkeys = Object.keys(sv)
    const allKeys = new Set([...keys, ...svkeys])
    for (const key of allKeys) {
      if (keys.length > 0) {
        if (!svkeys.includes(key)) {
          sv[key] = [id]
        } else if (!sv[key].includes(id)) {
          sv[key].push(id)
        } else if (!keys.includes(key)) {
          sv[key] = sv[key].filter(m => m !== id)
        }
      } else {
        if (svkeys.includes(key)) {
          sv[key] = sv[key].filter(m => m !== id)
        }
      }

      if (sv[key].length === 0) {
        delete sv[key]
      }
    }
  }

  @Mutation
  private DELETE_COM(com: DatavComponent) {
    if (com.type === ComType.com) {
      this.coms.splice(findComIndex(this.coms, com.id), 1)
    } else {
      this.subComs.splice(findComIndex(this.subComs, com.id), 1)
    }
  }

  @Mutation
  private ADD_COM(com: DatavComponent) {
    this.coms.push(com)
  }

  @Mutation
  private COPY_COM(id: string) {
    // 模拟后端复制
    const getNewCom = (com: DatavComponent, parentId?: string) => {
      const ncom = cloneDeep(com)
      ncom.id = generateId(ncom.name)
      ncom.alias += '_copy'
      ncom.attr.x += 30
      ncom.attr.y += 30

      ncom.hovered = false
      ncom.selected = false
      ncom.renameing = false

      ncom.parentId = parentId

      for (const key in ncom.apiData) {
        ncom.apiData[key].id = generateId()
        ncom.apiData[key].comId = ncom.id
      }

      return ncom
    }

    const ocom = findCom(this.coms, id)
    if (ocom) {
      const ncom = getNewCom(ocom)
      const nSubComs = findComs(this.subComs, ocom.id).map(m => getNewCom(m, ncom.id))
      this.coms.push(ncom)
      this.subComs.push(...nSubComs)
    }
  }

  @Action
  public async autoCanvasScale(payload: () => { offsetX: number; offsetY: number; }) {
    const resize = debounce(() => {
      const offset = payload()
      const width = document.documentElement.clientWidth - offset.offsetX
      const height = document.documentElement.clientHeight - 42 - 32 - offset.offsetY

      const a = (width - 120) / this.pageConfig.width
      const b = (height - 140) / this.pageConfig.height
      const scale = parseFloat((a > b ? b : a).toFixed(6)) * 100

      this.setCanvasScale({ scale, ...offset })
    }, 200)

    window.onresize = resize

    resize()
  }

  @Action
  public async setCanvasScale(payload: { scale: number; offsetX: number; offsetY: number; }) {
    let width = document.documentElement.clientWidth - payload.offsetX
    let height = document.documentElement.clientHeight - 42 - 32 - payload.offsetY
    const scale = Math.min(Math.max(payload.scale, 10), 200) / 100

    // 方便计算滚动条 和 标尺
    const deltaW = this.pageConfig.width * scale
    const deltaH = this.pageConfig.height * scale
    if (width < deltaW) {
      width = deltaW + 400
    }

    if (height < deltaH) {
      height = deltaH + 400
    }

    this.SET_CANVAS({ scale, width, height })
  }

  @Action
  public async loadScreen(projectId: number) {
    try {
      const res = await getProject(projectId)
      if (res.data.code === 0) {
        this.SET_SCREEN(res.data.data)
      } else {
        throw Error(res.data.message)
      }
    } catch (error) {
      throw error
    }
  }

  @Action
  public async loadComs(projectId: number) {
    try {
      const res = await getComs(projectId)
      if (res.data.code === 0) {
        this.SET_COMS(res.data.data)
      } else {
        throw Error(res.data.message)
      }
    } catch (error) {
      throw error
    }
  }

  @Action
  public async deleteCom(com: DatavComponent) {
    try {
      const res = await deleteCom(com.id)
      if (res.data.code === 0) {
        this.DELETE_COM(com)
      } else {
        throw Error(res.data.message)
      }
    } catch (error) {
      throw error
    }
  }

  @Action
  public async addCom(com: DatavComponent) {
    try {
      const res = await addCom(com)
      if (res.data.code === 0) {
        this.ADD_COM(com)
      } else {
        throw Error(res.data.message)
      }
    } catch (error) {
      throw error
    }
  }

  @Action
  public async copyCom(id: string) {
    try {
      const res = await copyCom(id)
      if (res.data.code === 0) {
        this.COPY_COM(id)
      } else {
        throw Error(res.data.message)
      }
    } catch (error) {
      throw error
    }
  }
}

export const EditorModule = getModule(Editor)
