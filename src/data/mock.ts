import { EditorModule } from '@/store/modules/editor'
import { createComponent } from '@/components/datav'
import { getRandomInt } from '@/utils/util'

export const useMock = () => {
  const { pageConfig } = EditorModule

  const names = ['VMainTitle', 'VNumberTitleFlop', 'VDatePicker']
  names.forEach(name => {
    const com = createComponent(name)
    // com.apis.source.useAutoUpdate = true
    // com.apis.source.autoUpdate = 5
    com.attr.x = getRandomInt(pageConfig.width - com.attr.w)
    com.attr.y = getRandomInt(pageConfig.height - com.attr.h)
    EditorModule.addCom(com)
  })
}
