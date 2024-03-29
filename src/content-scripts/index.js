import eventsToRecord from '../locator-generator/dom_events_to_record'
import elementsToBindTo from '../locator-generator/elements_to_bind_to'
import finder from '@medv/finder'

class EventRecorder {
    constructor(){
        this.eventLog = []
        this.previousEvent = null
    }

    start(){
        chrome.storage.local.get(['options'], ({ options }) => {
            const {dataAttribute} = options ? options.code : {}
            if (dataAttribute) {
              this.dataAttribute = dataAttribute
            }
      
            const events = Object.values(eventsToRecord)
            if (!window.recorderAddedControlListeners) {
              this.addAllListeners(elementsToBindTo, events)
              window.recorderAddedControlListeners = true
            }
      
            if (!window.document.recorderAddedControlListeners && chrome.runtime && chrome.runtime.onMessage) {
              const boundedGetCurrentUrl = this.getCurrentUrl.bind(this)
              const boundedGetViewPortSize = this.getViewPortSize.bind(this)
              chrome.runtime.onMessage.addListener(boundedGetCurrentUrl)
              chrome.runtime.onMessage.addListener(boundedGetViewPortSize)
              window.document.recorderAddedControlListeners = true
            }
        
            const msg = { control: 'event-recorder-started' }
            this.sendMessage(msg)
            console.debug('EventRecorder started')
        })
    }

    addAllListeners (elements, events) {
        const boundedRecordEvent = this.recordEvent.bind(this)
        events.forEach(type => {
            window.addEventListener(type, boundedRecordEvent, true)
        })
    }
    
    sendMessage (msg) {
        console.debug('sending message', msg)
        try {
            if (chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.sendMessage(msg)
            } else {
              this.eventLog.push(msg)
            }
        } catch (err) {
              console.debug('caught error', err)
        }
    }
    
    getCurrentUrl (msg) {
        if (msg.control && msg.control === 'get-current-url') {
          console.debug('sending current url:', window.location.href)
          this.sendMessage({ control: msg.control, href: window.location.href })
        }
    }
        
    getViewPortSize (msg) {
        if (msg.control && msg.control === 'get-viewport-size') {
            console.debug('sending current viewport size')
            this.sendMessage({ control: msg.control, coordinates: { width: window.innerWidth, height: window.innerHeight } })
        }
    }
    
    recordEvent (e) {
        if (this.previousEvent && this.previousEvent.timeStamp === e.timeStamp) return
        this.previousEvent = e
        
        const selector = e.target.hasAttribute && e.target.hasAttribute(this.dataAttribute)
            ? formatDataSelector(e.target, this.dataAttribute)
            : finder(e.target, { seedMinLength: 5, optimizedMinLength: 10, idName: name=>false })
        
        const msg = {
            selector: selector,
            value: e.target.value,
            tagName: e.target.tagName,
            action: e.type,
            keyCode: e.keyCode ? e.keyCode : null,
            href: e.target.href ? e.target.href : null,
            coordinates: getCoordinates(e),
            offset: getOffset(e)
        }
        this.sendMessage(msg)
    }

    getEventLog () {
        return this.eventLog
    }
        
    clearEventLog () {
        this.eventLog = []
    }
}

function getCoordinates (evt) {
    const eventsWithCoordinates = {
        mouseup: true,
        mousedown: true,
        mousemove: true,
        mouseover: true
    }
    return eventsWithCoordinates[evt.type] ? { x: evt.clientX, y: evt.clientY } : null
}

function getOffset(evt){
    const eventOffset = {
        mousedown: true
    }
    return eventOffset[evt.type] ? {x: evt.offsetX, y: evt.offsetY} : null
}
      
function formatDataSelector (element, attribute) {
    return `[${attribute}=${element.getAttribute(attribute)}]`
}

window.eventRecorder = new EventRecorder()
window.eventRecorder.start()