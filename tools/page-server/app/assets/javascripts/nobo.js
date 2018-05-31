(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// convert_ids
// © Will Smart 2018. Licence: MIT

// This module allows string ids to be converted to and from the various data pointer types used by nobo
// The types include:
//
//  rowId : a pointer to a particular row in a db table.
//          Made up of a snake_case table name and the id value for the row joined by double underscores
//          eg. user__1
//
//  datapointId : a pointer to a particular field value in a db table.
//          Made up of a rowId and a snake_case field name, joined by double underscores
//          eg. user__1__name
//          Note that link values are also seen as datapoints.
//          So user__1__posts could well be an array of rowId's for posts
//
// PROXIES
//  proxyRowId : a proxy pointer to a particular row in a db table as understood by a particular client.
//          Made up of a snake_case table name and a snake_case proxy key joined by double underscores
//          eg. user__me
//          In the case of user__me, the proxy key 'me' could be mapped to the current user's id
//          If logged out, user__me could be made to redirect to some other row, like app__default
//
// GENERAL
//  proxyableRowId : all rowId's and proxyRowId's are proxyableRowId's
//          This allows code to deal with both cases generally if need be
//

const typeNameRegex = /([a-z0-9]+(?:_[a-z0-9]+)*)/,
  dbRowIdRegex = /([1-9][0-9]*)/,
  fieldNameRegex = /([a-z0-9]+(?:_[a-z0-9]+)*)/,
  // Pointer to a row in the DB
  //   captures:
  //      [1]: typename in snake_case
  //      [2]: row id as an integer string
  rowRegex = new RegExp(`^${typeNameRegex.source}__${dbRowIdRegex.source}$`),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  datapointRegex = new RegExp(`^(${typeNameRegex.source}__${dbRowIdRegex.source})__~?${fieldNameRegex.source}$`),
  // at some levels the system uses 'proxy' and 'proxyable' row ids
  // eg, when retrieving a model like 'user__me' the 'me' is a proxy row id
  proxyKeyRegex = /([a-z][a-z0-9]*(?:_[a-z0-9]+)*)/,
  proxyableRowIdRegex = new RegExp(`(?:${dbRowIdRegex.source}|${proxyKeyRegex.source})`),
  // Pointer to a row in the DB, or a proxy to one
  //   captures:
  //      [1]: typename in snake_case
  //      [2]: row id as an integer string
  //      [3]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  proxyableRowRegex = new RegExp(`^${typeNameRegex.source}__${proxyableRowIdRegex.source}$`);
// Pointer to a particular expression of a row in the db
//   captures:
//      [1]: the row string
//      [2]: typename in snake_case
//      [3]: row id as an integer string
//      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")

// datapoints are never proxied

// API
module.exports = {
  // deconstructs a string id into its component parts or throws if not possible
  // arguments object with one key of:
  //   rowId, proxyableRowId, datapointId
  decomposeId,

  // similar, but will return the supplied argument unchanged if it already has typeName defined
  ensureDecomposed,

  // reconstructs string ids from their component parts or throws if not possible
  recomposeId,

  // export the regexes as part of the public API
  typeNameRegex,
  dbRowIdRegex,
  fieldNameRegex,
  rowRegex,
  datapointRegex,
  proxyKeyRegex,
  proxyableRowIdRegex,
  proxyableRowRegex
};

const ChangeCase = require("change-case");

// deconstructs a string id into its component parts or throws if not possible
//  arguments object with one key of:
//    rowId, proxyableRowId, datapointId
function decomposeId({ rowId, proxyableRowId, datapointId, relaxed }) {
  if (datapointId) return stringToDatapoint(datapointId);
  if (rowId) return stringToRow(rowId);
  if (proxyableRowId) return stringToProxyableRow(proxyableRowId);
  throw new Error("No id to decompose");
}

function ensureDecomposed({ typeName }) {
  return typeName === undefined ? decomposeId(arguments[0]) : arguments[0];
}

// reconstructs string ids from their component parts or throws if not possible
// you can provide more than one argument, in which case they are combined with the last taking precidence
function recomposeId({ typeName, dbRowId, proxyKey, fieldName, rowId, proxyableRowId }) {
  if (arguments.length != 1) {
    const combined = {};
    Array.prototype.forEach.call(arguments, argument => Object.assign(combined, argument));
    return recomposeId(combined);
  }

  if (rowId) {
    const args = decomposeId({ rowId });
    typeName = args.typeName;
    dbRowId = args.dbRowId;
  }

  if (proxyableRowId) {
    const args = decomposeId({ proxyableRowId });
    typeName = args.typeName;
    proxyKey = args.proxyKey;
  }

  if (!typeName) throw new Error("Can't recompose without typeName");

  const ret = {
    typeName: ChangeCase.snakeCase(typeName)
  };
  if (!typeNameRegex.test(ret.typeName)) throw new Error("Type name has invalid characters or format");

  if (dbRowId) {
    if (!dbRowIdRegex.test(dbRowId)) throw new Error("Db row id has invalid characters or format");
    ret.dbRowId = +dbRowId;
    ret.rowId = ret.proxyableRowId = `${ret.typeName}__${ret.dbRowId}`;

    if (fieldName) {
      ret.fieldName = ChangeCase.snakeCase(fieldName);
      if (!fieldNameRegex.test(ret.fieldName)) throw new Error("Field name has invalid characters or format");

      ret.datapointId = `${ret.rowId}__${ret.fieldName}`;
    }
  } else if (proxyKey) {
    ret.proxyKey = proxyKey;
    if (!proxyKeyRegex.test(ret.proxyKey)) throw new Error("Proxy key has invalid characters or format");
    ret.proxyRowId = ret.proxyableRowId = `${ret.typeName}__${ret.proxyKey}`;
  } else throw new Error("Must have either a dbRowId or a proxyKey");

  ret.typeName = ChangeCase.pascalCase(ret.typeName);
  if (ret.fieldName) ret.fieldName = ChangeCase.camelCase(ret.fieldName);

  return ret;
}

// Helper methods for applying the regexes

function stringToRow(rowId) {
  const match = rowRegex.exec(rowId);
  if (!match) throw new Error(`Bad row id ${rowId}`);

  return {
    rowId: rowId,
    proxyableRowId: rowId, // strictly, this row is proxyable too, and therefore has a proxyable id
    //  similar in methods below
    typeName: ChangeCase.pascalCase(match[1]),
    dbRowId: +match[2]
  };
}

function stringToDatapoint(datapointId) {
  const match = datapointRegex.exec(datapointId);
  if (!match) throw new Error(`Bad datapoint id ${datapointId}`);

  return {
    datapointId: datapointId,

    rowId: match[1],
    proxyableRowId: match[1],

    typeName: ChangeCase.pascalCase(match[2]),
    dbRowId: +match[3],
    fieldName: ChangeCase.camelCase(match[4])
  };
}

function stringToProxyableRow(rowId) {
  const match = proxyableRowRegex.exec(rowId);
  if (!match) throw new Error(`Bad row id ${rowId}`);

  return Object.assign(
    {
      proxyableRowId: rowId,
      typeName: ChangeCase.pascalCase(match[1])
    },
    match[2]
      ? {
          rowId: rowId,
          dbRowId: +match[2]
        }
      : {
          proxyRowId: rowId,
          proxyKey: match[3]
        }
  );
}

},{"change-case":15}],2:[function(require,module,exports){
const PublicApi = require("../general/public-api");

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const WebSocketClient = require("./web-socket-client");
const ConvertIds = require("../convert-ids");
const SharedState = require("./shared-state");
const { TemporaryState } = SharedState;

const callbackKey = "ClientDatapoints";

class WSClientDatapoints {
  // public methods
  static publicMethods() {
    return ["subscribe", "getDatapoint"];
  }

  constructor({ port }) {
    const clientDatapoints = this;

    SharedState.global.watch({
      callbackKey: "manage-subscriptions",
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject;

        if (!clientDatapoints.wsclient) return;

        forEachChangedKeyPath((keyPath, change) => {
          if (keyPath.length == 1 && keyPath[0] == "datapointsById") return true;

          if (keyPath.length == 2 && keyPath[0] == "datapointsById" && ConvertIds.datapointRegex.test(keyPath[1])) {
            if (!payloadObject) payloadObject = {};
            if (!payloadObject.datapoints) payloadObject.datapoints = {};
            switch (change.type) {
              case "delete":
                payloadObject.datapoints[keyPath[1]] = 0;
                break;
              case "insert":
                payloadObject.datapoints[keyPath[1]] = 1;
                break;
            }
          }
        });

        if (payloadObject) {
          clientDatapoints.wsclient.sendPayload({
            payloadObject
          });
        }
      }
    });

    clientDatapoints.wsclient = new WebSocketClient({
      port
    });

    clientDatapoints.wsclient.watch({
      callbackKey,
      onpayload: ({ messageIndex, messageType, payloadObject }) => {
        if (payloadObject.diffs) {
          SharedState.requestCommit(state => {
            for (const [datapointId, diff] of Object.entries(payloadObject.diffs)) {
              state.atPath("datapointsById")[datapointId] = diff;
              // TODO...
              // const datapoint = state.atPath('datapointsById', datapointId)
              // applyDiffToDatapoint({
              //   from: datapoint,
              //   diff
              // })
            }
          });
        }
      },
      onopen: () => {
        const state = SharedState.state,
          datapointsById = state.datapointsById;
        if (!datapointsById) return;

        let payloadObject;

        for (const datapointId of Object.keys(datapointsById)) {
          if (ConvertIds.datapointRegex.test(datapointId)) {
            if (!payloadObject) payloadObject = {};
            if (!payloadObject.datapoints) payloadObject.datapoints = {};
            payloadObject.datapoints[datapointId] = 1;
          }
        }

        if (payloadObject) {
          clientDatapoints.wsclient.sendPayload({
            payloadObject
          });
        }
      }
    });
  }

  getDatapoint(datapointId, defaultValue) {
    const clientDatapoints = this,
      datapointsById = SharedState.global.state.datapointsById || {};
    if (datapointsById[datapointId]) return datapointsById[datapointId];
    const tempState = SharedState.global.currentTemporaryState;
    if (tempState) tempState.atPath("datapointsById")[datapointId] = defaultValue;
    return defaultValue;
  }

  subscribe(datapointIds) {
    const clientDatapoints = this;

    if (typeof datapointIds == "string") datapointIds = [datapointIds];
    if (!Array.isArray(datapointIds)) datapointIds = Object.keys(datapointIds);
    if (!datapointIds.length) return;
    const datapointsById = {};
    for (const datapointId of datapointIds) datapointsById[datapointId] = 1;
    clientDatapoints.wsclient.sendPayload({
      payloadObject: { datapoints: datapointsById }
    });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WSClientDatapoints,
  hasExposedBackDoor: true
});

},{"../convert-ids":1,"../general/public-api":12,"./shared-state":7,"./web-socket-client":9}],3:[function(require,module,exports){
const ClientDatapoints = require("./client-datapoints"),
  WebSocketClient = require("./web-socket-client"),
  SharedState = require("./shared-state"),
  DomGenerator = require("./dom-generator"),
  DomUpdater = require("./dom-updater"),
  ConvertIds = require("../convert-ids"),
  { htmlToElement } = require("./dom-functions");

document.nobo = {
  ClientDatapoints,
  WebSocketClient,
  SharedState,
  DomGenerator,
  DomUpdater
};

document.nobo.datapoints = new document.nobo.ClientDatapoints();
document.nobo.domGenerator = new document.nobo.DomGenerator({
  htmlToElement,
  getDatapoint: (datapointId, defaultValue) => document.nobo.datapoints.getDatapoint(datapointId, defaultValue)
});
document.nobo.domUpdater = new document.nobo.DomUpdater({
  domGenerator: document.nobo.domGenerator
});

SharedState.global.watch({
  onchangedstate: function(diff, changes) {
    console.log(`>> State change: ${JSON.stringify(diff)}`);
  }
});

function testScript() {
  const { SharedState, ClientDatapoints, WebSocketClient } = document.nobo;
  document.nobo.datapoints.subscribe("user__1__app_name");
}

function locationPathFromRowIds(rowIds) {
  if (rowIds.length == 0) {
    return "";
  }
  const rowId = rowIds[0];
  if (ConvertIds.rowRegex.test(rowId)) {
    const decomposed = ConvertIds.decomposeId({ rowId });
    return `${decomposed.typeName}/${decomposed.dbRowId}`;
  }
  if (ConvertIds.datapointRegex.test(rowId)) {
    const decomposed = ConvertIds.decomposeId({ datapointId: rowId });
    return `${decomposed.typeName}/${decomposed.dbRowId}/${decomposed.fieldName}`;
  }
  return "";
}

function rowIdsFromLocationPath(path) {
  if (path === undefined) path = window.location.pathname;

  let match = /^\/([\w\d_]+)\/(\d+)(?:\/([\w\d_]+))?$/.exec(path);
  if (!match) match = [undefined, "app", "1"];
  const recomposed = ConvertIds.recomposeId({
    typeName: match[1],
    dbRowId: match[2],
    fieldName: match[3]
  });
  return [recomposed.datapointId || recomposed.rowId];
}

function locationPathFromRowIds(rowIds) {
  return rowIds.join("___");
}

SharedState.global.watch({
  callbackKey: "location-watch",
  onchangedstate: function(diff, changes, forEachChangedKeyPath) {
    forEachChangedKeyPath((keyPath, change) => {
      switch (keyPath.length) {
        case 0:
          return true;
        case 1:
          return keyPath[0] == "datapointsById";
        case 2:
          if (keyPath[0] == "datapointsById" && keyPath[1] == "page" && Array.isArray(change.is)) break;
        default:
          return false;
      }

      const path = locationPathFromRowIds(change.is);
      console.log(path);
    });
  }
});

function setPage(rowId) {
  SharedState.global.requestCommit(temp => {
    temp.atPath("datapointsById").page = [rowId];
  });
}

setPage(rowIdsFromLocationPath()[0]);

},{"../convert-ids":1,"./client-datapoints":2,"./dom-functions":4,"./dom-generator":5,"./dom-updater":6,"./shared-state":7,"./web-socket-client":9}],4:[function(require,module,exports){
const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");

// API is just all the functions
module.exports = {
  datapointChildrenClass,
  datapointValueFieldClass,
  datapointTemplateFieldClass,
  datapointDomFieldClass,
  childrenPlaceholders,
  datapointValueElements,
  datapointTemplateElements,
  datapointDomElements,
  elementChildrenFieldName,
  childrenFieldNameForElement,
  htmlToElement,
  templateDatapointIdForRowAndVariant,
  nextChild,
  skipAllChildren,
  skipChildren,
  _nextChild,
  _skipAllChildren,
  _skipChildren,
  rangeForElement,
  childRangeAtIndex
};

function datapointChildrenClass(datapointId) {
  return `children--${datapointId}`;
}

function datapointValueFieldClass(datapointId) {
  return `value--${datapointId}`;
}

function datapointTemplateFieldClass(datapointId) {
  return `template--${datapointId}`;
}

function datapointDomFieldClass(datapointId) {
  return `dom--${datapointId}`;
}

function childrenPlaceholders(datapointId) {
  return document.getElementsByClassName(datapointChildrenClass(datapointId));
}
function datapointValueElements(datapointId) {
  return document.getElementsByClassName(datapointValueFieldClass(datapointId));
}
function datapointTemplateElements(datapointId) {
  return document.getElementsByClassName(datapointTemplateFieldClass(datapointId));
}
function datapointDomElements(datapointId) {
  return document.getElementsByClassName(datapointDomFieldClass(datapointId));
}

function elementChildrenFieldName(element) {
  for (const className of element.classList) {
    const match = /^(\w+)-model-child$/.exec(className);
    if (match) return ChangeCase.camelCase(match[1]);
  }
}

function childrenFieldNameForElement(element) {
  for (const className of element.classList) {
    const match = /(\w+)-model-child/.exec(className);
    if (match) return match[1];
  }
}
function htmlToElement(html) {
  var template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

function templateDatapointIdForRowAndVariant(rowId, variant) {
  return ConvertIds.recomposeId({
    rowId,
    fieldName: `template_${variant}`
  }).datapointId;
}

function nextChild(placeholderUid, previousChildElement) {
  return _nextChild(placeholderUid, [previousChildElement]);
}

function skipAllChildren(placeholderUid, previousChildElement) {
  return _skipAllChildren(placeholderUid, [previousChildElement]);
}

function skipChildren(placeholderUid, previousChildElement, count) {
  return _skipChildren(placeholderUid, [previousChildElement], count);
}

function _nextChild(placeholderUid, currentChildElementArray) {
  const previousChildElement = currentChildElementArray[0],
    previousChildUid = previousChildElement.getAttribute("nobo-uid");
  let element = previousChildElement.nextElementSibling;
  currentChildElementArray[1] = previousChildElement;
  currentChildElementArray[0] = element;
  if (element && element.getAttribute("nobo-placeholder-uid") == placeholderUid) return element;

  if (!previousChildUid || element.getAttribute("nobo-placeholder-uid") != previousChildUid) return;
  element = _skipAllChildren(previousChildUid, currentChildElementArray);

  return element && element.getAttribute("nobo-placeholder-uid") == placeholderUid ? element : undefined;
}

function _skipAllChildren(placeholderUid, currentChildElementArray) {
  while (_nextChild(placeholderUid, currentChildElementArray));
  return currentChildElementArray[0];
}

function _skipChildren(placeholderUid, currentChildElementArray, count) {
  for (let index = 0; index < count; index++) {
    if (!_nextChild(placeholderUid, currentChildElementArray)) return;
  }
  return currentChildElementArray[0];
}

function rangeForElement(startElement) {
  if (!startElement) return [undefined, undefined];
  const currentChildElementArray = [startElement];
  _nextChild(startElement.getAttribute("nobo-placeholder-uid"), currentChildElementArray);
  return [startElement, currentChildElementArray[1]];
}

function childRangeAtIndex({ placeholderDiv, index }) {
  if (index < 0) return [placeholderDiv, placeholderDiv];
  const placeholderUid = placeholderDiv.getAttribute("nobo-uid"),
    firstElement = placeholderDiv.nextElementSibling;

  if (!firstElement || firstElement.getAttribute("nobo-placeholder-uid") != placeholderUid) return [];
  const startElement = skipChildren(placeholderUid, firstElement, index);
  if (!startElement) return [];
  const currentChildElementArray = [startElement];
  _nextChild(placeholderUid, currentChildElementArray);
  return [startElement, currentChildElementArray[1]];
}

},{"../convert-ids":1,"../general/public-api":12}],5:[function(require,module,exports){
const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");
const TemplatedText = require("./templated-text");

const {
  templateDatapointIdForRowAndVariant,
  htmlToElement,
  datapointTemplateFieldClass,
  datapointDomFieldClass,
  datapointChildrenClass,
  datapointValueFieldClass,
  childrenFieldNameForElement
} = require("./dom-functions");

// API is auto-generated at the bottom from the public interface of this class

class DomGenerator {
  // public methods
  static publicMethods() {
    return [
      "createElementsForVariantOfRow",
      "createChildElements",
      "createElementsUsingTemplateDatapointId",
      "createElementsUsingDomDatapointId"
    ];
  }

  constructor({ getDatapoint, htmlToElement }) {
    const domGenerator = this;

    domGenerator.getDatapoint = getDatapoint;
    domGenerator.nextUid = 1;
    domGenerator.htmlToElement = htmlToElement;
  }

  createElementsForVariantOfRow({ variant, rowId, placeholderUid }) {
    variant = variant || "";
    const domGenerator = this,
      templateDatapointId =
        typeof rowId == "string" && typeof rowId == "string" && ConvertIds.rowRegex.test(rowId)
          ? templateDatapointIdForRowAndVariant(rowId, variant)
          : undefined;
    return domGenerator.createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid });
  }

  createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid }) {
    const domGenerator = this;

    let domDatapointId, rowId;
    if (templateDatapointId) {
      rowId = ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId;
      const templateDatapoint = domGenerator.getDatapoint(templateDatapointId, []);
      if (
        Array.isArray(templateDatapoint) &&
        templateDatapoint.length == 1 &&
        ConvertIds.rowRegex.test(templateDatapoint[0])
      ) {
        domDatapointId = ConvertIds.recomposeId({ rowId: templateDatapoint[0], fieldName: "dom" }).datapointId;
      }
    }

    const elements = domGenerator.createElementsUsingDomDatapointId({
      templateDatapointId,
      domDatapointId,
      rowId,
      placeholderUid
    });

    return elements;
  }

  createElementsUsingDomDatapointId({ templateDatapointId, domDatapointId, rowId, placeholderUid }) {
    const domGenerator = this,
      domString =
        (domDatapointId ? domGenerator.getDatapoint(domDatapointId, "<div></div>") : undefined) || "<div></div>";

    let element = (domGenerator.htmlToElement || htmlToElement)(domString);
    if (!element) element = (domGenerator.htmlToElement || htmlToElement)("<div></div>");

    if (placeholderUid) element.setAttribute("nobo-placeholder-uid", placeholderUid);

    element.classList.add("nobodom"); // a coverall class for any element that is the root of a nobo dom tree,

    if (domDatapointId) {
      element.setAttribute("nobo-dom-dpid", domDatapointId);
      element.classList.add(datapointDomFieldClass(domDatapointId));
    }

    if (templateDatapointId) {
      element.setAttribute("nobo-template-dpid", templateDatapointId);
      element.classList.add(datapointTemplateFieldClass(templateDatapointId));
    }

    const elements = [element];
    if (rowId) {
      elements.push(
        ...domGenerator.prepDomTreeAndCreateChildren({
          element,
          rowId
        })
      );
    }
    return elements;
  }

  prepDomTreeAndCreateChildren({ element, rowId }) {
    const domGenerator = this;

    let nextElementSibling;
    for (let childElement = element.firstElementChild; childElement; childElement = nextElementSibling) {
      nextElementSibling = childElement.nextElementSibling;
      const additionalChildElements = domGenerator.prepDomTreeAndCreateChildren({ element: childElement, rowId });
      for (let index = additionalChildElements.length - 1; index >= 0; index--) {
        childElement.insertAdjacentElement("afterend", additionalChildElements[index]);
      }
    }

    domGenerator.prepValueFields({ element, rowId });

    return domGenerator.prepChildrenPlaceholderAndCreateChildren({ element, rowId });
  }

  prepChildrenPlaceholderAndCreateChildren({ element, rowId }) {
    const domGenerator = this;

    let fieldName = childrenFieldNameForElement(element);
    if (!fieldName) return [];

    const datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId;

    const placeholderUid = domGenerator.nextUid++;
    element.setAttribute("nobo-children-dpid", datapointId);
    element.setAttribute("nobo-uid", placeholderUid);
    element.classList.add("noboplaceholder", datapointChildrenClass(datapointId));

    const variant = element.getAttribute("variant") || undefined,
      additionalSiblings = domGenerator.createChildElements({ datapointId, variant, placeholderUid });
    return additionalSiblings;
  }

  createChildElements({ datapointId, variant, placeholderUid }) {
    const domGenerator = this,
      rowIds = domGenerator.getDatapoint(datapointId, []);

    if (!Array.isArray(rowIds)) return [];

    const childElements = [];
    for (const rowId of rowIds) {
      if (typeof rowId != "string" || !ConvertIds.rowRegex.test(rowId)) rowId = undefined;
      childElements.push(
        ...domGenerator.createElementsForVariantOfRow({
          variant,
          rowId,
          placeholderUid
        })
      );
    }
    return childElements;
  }

  prepValueFields({ element, rowId }) {
    let index = 0;
    const usesByDatapointId = {};

    for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
      if (childNode.nodeType == 3) {
        const backupName = `nobo-backup-text-${index}`;
        if (element.hasAttribute(backupName)) continue;

        const templatedText = new TemplatedText({ rowId, text: childNode.textContent });
        if (templatedText.datapointIds.length) {
          for (const datapointId of templatedText.datapointIds) {
            usesByDatapointId[datapointId] = usesByDatapointId[datapointId] || {};
            usesByDatapointId[datapointId][`=${index}`] = true;
          }
          element.setAttribute(backupName, childNode.textContent);
          //TODO substituteTextNode({element, index})
        }

        index++;
      }
    }

    if (element.hasAttributes())
      for (const { name, value } of element.attributes) {
        if (name.startsWith("nobo-")) continue;

        const backupName = `nobo-backup--${name}`;
        if (element.hasAttribute(backupName)) continue;

        const templatedText = new TemplatedText({ rowId, text: value });
        if (templatedText.datapointIds.length) {
          for (const datapointId of templatedText.datapointIds) {
            usesByDatapointId[datapointId] = usesByDatapointId[datapointId] || {};
            usesByDatapointId[datapointId][name] = true;
          }
          element.setAttribute(backupName, value);
          //TODOsubstituteAttribute({element, attributeName: name})
        }
      }

    for (const [datapointId, uses] of Object.entries(usesByDatapointId)) {
      const usesName = `nobo-uses-${datapointId}`;
      if (element.hasAttribute(usesName)) continue;

      element.classList.add(datapointValueFieldClass(datapointId));
      element.setAttribute(usesName, Object.keys(uses).join(" "));
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomGenerator,
  hasExposedBackDoor: true
});

},{"../convert-ids":1,"../general/public-api":12,"./dom-functions":4,"./templated-text":8}],6:[function(require,module,exports){
const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");
const TemplatedText = require("./templated-text");
const SharedState = require("./shared-state");

const {
  templateDatapointIdForRowAndVariant,
  htmlToElement,
  datapointTemplateFieldClass,
  datapointDomFieldClass,
  datapointChildrenClass,
  datapointValueFieldClass,
  childrenFieldNameForElement,
  childrenPlaceholders,
  datapointValueElements,
  datapointTemplateElements,
  datapointDomElements,
  rangeForElement,
  childRangeAtIndex
} = require("./dom-functions");

// API is auto-generated at the bottom from the public interface of this class

class DomUpdater {
  // public methods
  static publicMethods() {
    return ["datapointUpdated"];
  }

  constructor({ domGenerator }) {
    const domUpdater = this;

    domUpdater.domGenerator = domGenerator;

    domUpdater.startWatch();
  }

  startWatch() {
    const domUpdater = this;

    SharedState.global.watch({
      callbackKey: "dom-updater",
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        const replacements = [];

        forEachChangedKeyPath((keyPath, change) => {
          if (!keyPath.length || keyPath[0] != "datapointsById") return;
          if (keyPath.length < 2) return true;

          const datapointId = keyPath[1];

          if (keyPath.length == 2) {
            replacements.push(...domUpdater.datapointUpdated({ datapointId: keyPath[1], change }));
            if (Array.isArray(change.is)) return true;
          } else if (keyPath.length == 3 && typeof keyPath[2] == "number") {
            replacements.push(
              ...domUpdater.datapointMemberUpdated({ datapointId: keyPath[1], index: +keyPath[2], change })
            );
          }
        });

        if (replacements.length) {
          domUpdater.commitDomReplacements({ replacements });
        }
      }
    });
  }

  createElementsWithUpdatedTemplateDatapoint({ element }) {
    const domUpdater = this,
      templateDatapointId = element.getAttribute("nobo-template-dpid"),
      placeholderUid = element.getAttribute("nobo-placeholder-uid");
    if (!templateDatapointId) return;

    return domUpdater.domGenerator.createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid });
  }

  createElementsWithUpdatedDomDatapoint({ element }) {
    const domUpdater = this,
      templateDatapointId = element.getAttribute("nobo-template-dpid"),
      domDatapointId = element.getAttribute("nobo-dom-dpid"),
      placeholderUid = element.getAttribute("nobo-placeholder-uid");
    if (!(templateDatapointId && domDatapointId)) return;

    const rowId = ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId;

    return domUpdater.domGenerator.createElementsUsingDomDatapointId({
      templateDatapointId,
      domDatapointId,
      rowId,
      placeholderUid
    });
  }

  markRangeAsDead([start, end]) {
    for (let element = start; ; element = element.nextElementSibling) {
      element.classList.add("nobo-dead");
      if (element == end) break;
    }
  }
  datapointUpdated({ datapointId }) {
    const domUpdater = this,
      replacements = [];
    for (const element of datapointTemplateElements(datapointId)) {
      const range = rangeForElement(element);
      replacements.push({
        replaceRange: range,
        elements: domUpdater.createElementsWithUpdatedTemplateDatapoint({ element })
      });
      domUpdater.markRangeAsDead(range);
    }
    for (const element of datapointDomElements(datapointId)) {
      const range = rangeForElement(element);
      replacements.push({
        replaceRange: range,
        elements: domUpdater.createElementsWithUpdatedDomDatapoint({ element })
      });
      domUpdater.markRangeAsDead(range);
    }
    for (const element of datapointValueElements(datapointId)) {
    }

    return replacements;
  }

  datapointMemberUpdated({ datapointId, index, change }) {
    const domUpdater = this,
      replacements = [];

    for (const element of childrenPlaceholders(datapointId)) {
      const variant = element.getAttribute("variant") || undefined,
        placeholderUid = element.getAttribute("nobo-uid"),
        rowId = ConvertIds.rowRegex.test(change.is) ? change.is : undefined,
        range = childRangeAtIndex({ placeholderDiv: element, index });
      if (change.index !== undefined) {
        switch (change.type) {
          case "insert":
            const afterRange = childRangeAtIndex({ placeholderDiv: element, index: index - 1 });
            replacements.push({
              afterElement: afterRange[1],
              elements: domUpdater.domGenerator.createElementsForVariantOfRow({
                rowId,
                variant,
                placeholderUid
              })
            });
            break;
          case "change":
            domUpdater.markRangeAsDead(range);
            replacements.push({
              replaceRange: range,
              elements: domUpdater.domGenerator.createElementsForVariantOfRow({
                rowId,
                variant,
                placeholderUid
              })
            });
            break;
          case "delete":
            domUpdater.markRangeAsDead(range);
            replacements.push({
              replaceRange: range
            });
            break;
        }
      }
    }

    return replacements;
  }

  commitDomReplacements({ replacements }) {
    for (const replacement of replacements) {
      const { replaceRange, afterElement, elements } = replacement;

      if (afterElement) {
        for (let index = elements.length - 1; index >= 0; index--) {
          afterElement.insertAdjacentElement("afterend", elements[index]);
        }
      } else if (replaceRange) {
        if (elements && elements.length) {
          let previousElementSibling;
          for (let element = replaceRange[1]; element !== replaceRange[0]; element = previousElementSibling) {
            previousElementSibling = element.previousElementSibling;
            element.parentNode.removeChild(element);
          }
          replaceRange[0].parentNode.replaceChild(elements[0], replaceRange[0]);
          for (let index = elements.length - 1; index > 0; index--) {
            elements[0].insertAdjacentElement("afterend", elements[index]);
          }
        } else {
          let previousElementSibling;
          for (let element = replaceRange[1]; ; element = previousElementSibling) {
            previousElementSibling = element.previousElementSibling;
            element.parentNode.removeChild(element);
            if (element === replaceRange[0]) break;
          }
        }
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomUpdater,
  hasExposedBackDoor: true
});

},{"../convert-ids":1,"../general/public-api":12,"./dom-functions":4,"./shared-state":7,"./templated-text":8}],7:[function(require,module,exports){
(function (global){
const PublicApi = require("../general/public-api");
const makeClassWatchable = require("../general/watchable");
const diffAny = require("../general/diff");
const { shallowCopy, shallowCopyObjectIfSame } = require("../general/clone");

// API is auto-generated at the bottom from the public interface of the SharedState class

// TemporaryState encapsulates the changes to the shared state object.
// To change the state object you request a commit witht he requestCommit method.
//  The callback you provide is passed a TemporaryState object, which you can modify using the atPath accessor
//
// eg
//  SharedState.requestCommit(temp=>{temp.atPath('datapoints',datapointId).name = 'newName'})
class TemporaryState {
  static publicMethods() {
    return ["atPath", "state", "current"];
  }

  static get current() {
    return SharedState.global.currentTemporaryState;
  }

  constructor({ fromState }) {
    const temporaryState = this;

    temporaryState._state = temporaryState.fromState = fromState;
  }

  get state() {
    return this._state;
  }

  atPath(...keyPath) {
    const temporaryState = this;

    let fromState = temporaryState.fromState,
      state = shallowCopyObjectIfSame(fromState, temporaryState, "_state");
    for (const key of keyPath) {
      state = shallowCopyObjectIfSame((fromState = fromState[key]), state, key);
    }
    return state;
  }
}

const TemporaryState_public = PublicApi({
  fromClass: TemporaryState,
  hasExposedBackDoor: true
});

let globalSharedState;

class SharedState {
  static publicMethods() {
    return ["global", "requestCommit", "state", "watch", "stopWatching", "currentTemporaryState"];
  }

  constructor() {
    const sharedState = this;
    sharedState._state = {};
    sharedState.commitPromise = Promise.resolve();
  }

  static get state() {
    return SharedState.global.state;
  }

  get currentTemporaryState() {
    return this._currentTemporaryState;
  }

  get state() {
    return this._state;
  }

  static get global() {
    return globalSharedState ? globalSharedState : (globalSharedState = new SharedState());
  }

  static requestCommit(modifyStateCallback) {
    SharedState.global.requestCommit(modifyStateCallback);
  }

  async requestCommit(modifyStateCallback) {
    const sharedState = this;

    sharedState.commitPromise = sharedState.commitPromise.then(() => {
      let temporaryState = new TemporaryState({
        fromState: sharedState.state
      });
      sharedState._currentTemporaryState = temporaryState;
      modifyStateCallback(temporaryState);

      let commitTemporaryState;
      while (true) {
        commitTemporaryState = sharedState._currentTemporaryState = new TemporaryState({
          fromState: temporaryState.state
        });

        if (
          sharedState.commit({
            toState: temporaryState.state
          }) === undefined
        )
          break;

        temporaryState = commitTemporaryState;
      }
      delete sharedState._currentTemporaryState;
    });

    await sharedState.commitPromise;
  }

  commit({ toState }) {
    const sharedState = this,
      fromState = sharedState.state;

    const diff = diffAny(fromState, toState);
    if (!diff) return;

    const changes = sharedState.changeListFromDiff(diff, fromState, toState);

    const forEachChangedKeyPath = callback => {
      let keyPath = [];
      for (const change of changes) {
        if (change.depth < keyPath.length) keyPath.splice(change.depth, keyPath.length - change.depth);
        if (change.key != undefined) {
          keyPath.push(change.key);
        }
        if (change.index != undefined) {
          keyPath.push(change.index);
        }
        if (callback(keyPath, change)) {
          switch (change.type) {
            case "delete":
              forEachDeletedElement(change.depth, keyPath, change.was, callback);
              break;
            case "insert":
              forEachInsertedElement(change.depth, keyPath, change.is, callback);
              break;
          }
        }
      }

      function forEachDeletedElement(depth, keyPath, arrayOrObject, callback) {
        if (Array.isArray(arrayOrObject)) forEachDeletedArrayElement(depth, keyPath, arrayOrObject, callback);
        if (typeof arrayOrObject == "object") forEachDeletedObjectElement(depth, keyPath, arrayOrObject, callback);
      }

      function forEachInsertedElement(depth, keyPath, arrayOrObject, callback) {
        if (Array.isArray(arrayOrObject)) forEachInsertedArrayElement(depth, keyPath, arrayOrObject, callback);
        if (typeof arrayOrObject == "object") forEachInsertedObjectElement(depth, keyPath, arrayOrObject, callback);
      }

      function forEachDeletedArrayElement(depth, keyPath, array, callback) {
        keyPath.push(0);
        depth++;
        for (let index = array.length - 1; index >= 0; index--) {
          keyPath[keyPath.length - 1] = index;
          if (
            callback(keyPath, {
              type: "delete",
              depth,
              index,
              was: array[index]
            })
          ) {
            forEachDeletedElement(depth, keyPath, array[index], callback);
          }
        }
        keyPath.pop();
      }

      function forEachInsertedArrayElement(depth, keyPath, array, callback) {
        keyPath.push(0);
        depth++;
        for (let index = array.length - 1; index >= 0; index--) {
          keyPath[keyPath.length - 1] = 0;
          if (
            callback(keyPath, {
              type: "insert",
              depth,
              index: 0,
              is: array[index]
            })
          ) {
            forEachInsertedElement(depth, keyPath, array[index], callback);
          }
        }
        keyPath.pop();
      }

      function forEachDeletedObjectElement(depth, keyPath, object, callback) {
        keyPath.push(0);
        depth++;
        for (const [key, value] of Object.entries(object)) {
          keyPath[keyPath.length - 1] = key;
          if (
            callback(keyPath, {
              type: "delete",
              depth,
              key,
              was: value
            })
          ) {
            forEachDeletedElement(depth, keyPath, value, callback);
          }
        }
        keyPath.pop();
      }

      function forEachInsertedObjectElement(depth, keyPath, object, callback) {
        keyPath.push(0);
        depth++;
        for (const [key, value] of Object.entries(object)) {
          keyPath[keyPath.length - 1] = key;
          if (
            callback(keyPath, {
              type: "insert",
              depth,
              key,
              is: value
            })
          ) {
            forEachInsertedElement(depth, keyPath, value, callback);
          }
        }
        keyPath.pop();
      }
    };

    sharedState.notifyListeners("onwillchangesate", diff, changes, forEachChangedKeyPath, fromState, toState);
    sharedState._state = toState;
    sharedState.notifyListeners("onchangedstate", diff, changes, forEachChangedKeyPath, fromState, toState);

    return toState;
  }

  changeListFromDiff(diff, was, is, retChanges, depth) {
    if (!diff) return retChanges;

    depth = depth || 0;

    retChanges = retChanges || [];
    if (!depth) {
      retChanges.push({
        depth: -1,
        type: "change",
        was,
        is
      });
    }

    const sharedState = this;

    if (diff.objectDiff) {
      for (const [key, childDiff] of Object.entries(diff.objectDiff)) {
        const wasChild = typeof was == "object" && !Array.isArray(was) ? was[key] : undefined,
          isChild = typeof is == "object" && !Array.isArray(is) ? is[key] : undefined;

        retChanges.push({
          depth,
          type: wasChild === undefined ? "insert" : isChild === undefined ? "delete" : "change",
          key,
          was: wasChild,
          is: isChild
        });

        if (isChild === undefined || wasChild === undefined) {
          continue;
        }

        sharedState.changeListFromDiff(childDiff, wasChild, isChild, retChanges, depth + 1);
      }
    } else if (diff.arrayDiff) {
      let deletes = 0,
        inserts = 0;
      const wasArray = Array.isArray(was) ? was : [];
      const isArray = Array.isArray(is) ? is : [];
      for (const childDiff of diff.arrayDiff) {
        if (childDiff.at !== undefined) {
          const wasIndex = childDiff.at,
            isIndex = childDiff.at + inserts - deletes,
            wasChild = wasArray[wasIndex],
            isChild = isArray[isIndex];

          retChanges.push({
            depth,
            type: "change",
            index: wasIndex,
            was: wasChild,
            is: isChild
          });
          sharedState.changeListFromDiff(childDiff, wasChild, isChild, retChanges, depth + 1);
        } else if (childDiff.deleteAt !== undefined) {
          const wasIndex = childDiff.deleteAt,
            wasChild = wasArray[wasIndex];

          retChanges.push({
            depth,
            type: "delete",
            index: wasIndex,
            was: wasChild
          });

          deletes++;
        } else if (childDiff.insertAt !== undefined) {
          const wasIndex = childDiff.insertAt,
            isIndex = childDiff.insertAt + inserts - deletes,
            isChild = isArray[isIndex];

          retChanges.push({
            depth,
            type: "insert",
            index: wasIndex,
            is: isChild
          });

          inserts++;
        }
      }
    }

    return retChanges;
  }
}

makeClassWatchable(SharedState);

const SharedState_public = PublicApi({
  fromClass: SharedState,
  hasExposedBackDoor: true
});
SharedState_public.TemporaryState = PublicApi({
  fromClass: TemporaryState,
  hasExposedBackDoor: true
});

// API is the public facing class
module.exports = SharedState_public;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../general/clone":10,"../general/diff":11,"../general/public-api":12,"../general/watchable":13}],8:[function(require,module,exports){
const PublicApi = require("../general/public-api");

const ConvertIds = require("../convert-ids");

// API is auto-generated at the bottom from the public interface of this class

class TemplatedText {
  // public methods
  static publicMethods() {
    return ["ranges", "datapointIds"];
  }

  constructor({ text, rowId }) {
    this.templateString = text;
    this.rowId = rowId;
  }

  get ranges() {
    const templatedText = this,
      templateString = templatedText.templateString;
    if (templatedText._ranges) return templatedText._ranges;
    if (typeof templateString != "string") return (templatedText._ranges = []);
    return (templatedText._ranges = templatedText.getRanges(this.templateString));
  }

  getRanges(text, fromIndex, delimiters) {
    const templatedText = this,
      ranges = [];

    let prevIndex = fromIndex || 0,
      match;

    const regex = new RegExp(
        `^((?:\\\\\\\\|[^\\\\${delimiters || ""}])*)(${delimiters ? `([${delimiters}])|` : ""}(\\$\\{)|$)`,
        "g"
      ),
      delimiterCapi = delimiters ? 3 : undefined,
      bracketCapi = delimiters ? 4 : 3;

    while (true) {
      regex.lastIndex = prevIndex;
      if (!(match = regex.exec(text))) break;

      let textEnd = prevIndex + match[1].length,
        end = textEnd + match[2].length;
      if (!match[bracketCapi]) {
        if (prevIndex < textEnd) {
          const snippet = text.substring(prevIndex, textEnd);
          if (!prevIndex && ConvertIds.fieldNameRegex.test(snippet) && templatedText.rowId) {
            ranges.push({
              datapointId: ConvertIds.recomposeId({ rowId: templatedText.rowId, fieldName: snippet }).datapointId
            });
          } else ranges.push(snippet);
        }
        return {
          ranges,
          delimiter: delimiters && match[delimiterCapi] ? match[delimiterCapi] : undefined,
          matchEnd: end
        };
      }

      const range = {};
      let { delimiter, subRanges, matchEnd } = getRanges(text, end, "?|}");
      if (!delimiter) {
        ranges.push(text.substring(prevIndex));
        return { ranges };
      }

      if (delimiter == "?") {
        range.condition = subRanges;
        ({ delimiter, subRanges, matchEnd } = getRanges(text, matchEnd, "|}"));
        if (!delimiter) {
          ranges.push(text.substring(prevIndex));
          return { ranges };
        }
      }

      if (delimiter == "|") {
        range.truthy = subRanges;
        ({ delimiter, subRanges, matchEnd } = getRanges(text, matchEnd, "}"));
        if (!delimiter) {
          ranges.push(text.substring(prevIndex));
          return { ranges };
        }
        range.falsey = subRanges;
      } else range.truthy = subRanges;

      ranges.push(range);

      prevIndex = matchEnd;
    }
  }

  get datapointIds() {
    const templatedText = this;
    if (templatedText._datapointIds) return templatedText._datapointIds;

    const ranges = templatedText.ranges,
      datapointsById = {};

    gather(ranges);
    return (templatedText._datapointIds = Object.keys(datapointsById));

    function gather(range) {
      if (typeof range != "object") return;
      if (range.datapointId) {
        datapointsById[range.datapointId] = true;
        return;
      }
      if (range.condition) gather(range.condition);
      if (range.falsey) gather(range.falsey);
      if (range.truthy) gather(range.truthy);
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: TemplatedText,
  hasExposedBackDoor: true
});

},{"../convert-ids":1,"../general/public-api":12}],9:[function(require,module,exports){
const WebSocket = require("isomorphic-ws");
const ConvertIds = require("../convert-ids");
const PublicApi = require("../general/public-api");
const makeClassWatchable = require("../general/watchable");
const ServerDatapoints = require("../server-datapoints");

// API is auto-generated at the bottom from the public interface of this class

class WebSocketClient {
  // public methods
  static publicMethods() {
    return ["sendMessage", "sendPayload", "isOpen", "watch", "stopWatching"];
  }

  constructor({
    port = 3100
  } = {}) {
    const client = this;

    client._isOpen = false
    client.nextMessageIndex = 1
    client.clientParams = {
      port: port
    };

    function open() {
      const ws = client.ws = new WebSocket(`ws://localhost:${port}`);

      ws.onopen = function open() {
        client._isOpen = true
        client.notifyListeners('onopen')

        client.pongHistory = [0, 0, 0, 1],
          client.pongCount = 1;

      };

      ws.onclose = function close() {
        clearInterval(ws.pingInterval);
        client._isOpen = false
        client.notifyListeners('onclose')
        setTimeout(() => open(), 2000)
      };

      if (ws.on) {
        ws.on("pong", () => {
          ws.pongHistory[ws.pongHistory.length - 1]++;
          ws.pongCount++;
        });
      }

      ws.onmessage = function incoming(message) {
        client.notifyListeners('onpayload', WebSocketClient.decodeMessage({
          message: message.data
        }))
      };

      ws.onerror = (err) => {
        console.log(`Error: ${err.message}`);
      }

      if (ws.ping) {
        ws.pingInterval = setInterval(function ping() {
          if (!ws.pongCount) {
            return ws.close();
          }

          ws.pongHistory.push(0);
          clwsient.pongCount -= ws.pongHistory.shift()

          ws.ping("", false, true);
        }, 10000);
      }
    }
    open()

    console.log(`Web socket client listening to server on port ${port}`);
  }

  get isOpen() {
    return this._isOpen
  }

  static decodeMessage({
    message
  }) {
    const matches = /^(?:(\d+)|(\w+)):/.exec(message),
      messageIndex = matches && matches[1] !== undefined ? +matches[1] : -1,
      messageType = matches && matches[2] !== undefined ? matches[2] : undefined;
    if (matches) message = message.substring(matches[0].length);

    let payloadObject
    try {
      payloadObject = JSON.parse(message)
    } catch (err) {
      payloadObject = message
    }
    if (Array.isArray(payloadObject)) {
      payloadObject = {
        array: payloadObject
      }
    } else if (typeof (payloadObject) != 'object') {
      payloadObject = {
        message: `${payloadObject}`
      }
    }

    return {
      messageIndex,
      messageType,
      payloadObject
    }

  }
  get cache() {
    return this._cache
  }

  sendMessage({
    message
  }) {
    this.sendPayload(WebSocketClient.decodeMessage({
      message
    }))
  }

  sendPayload({
    messageIndex = -1,
    messageType,
    payloadObject
  }) {
    const client = this;

    if (!client.isOpen) return;

    if (messageIndex == -1 && !messageType) messageIndex = client.nextMessageIndex++;
    const message = `${messageIndex==-1 ? (messageType ? `${messageType}:` : '') : `${messageIndex}:`}${JSON.stringify(payloadObject)}`
    console.log("Sending message to server:   " + message);

    client.ws.send(message)
  }
}


makeClassWatchable(WebSocketClient)

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketClient,
  hasExposedBackDoor: true
});
},{"../convert-ids":1,"../general/public-api":12,"../general/watchable":13,"../server-datapoints":37,"isomorphic-ws":21}],10:[function(require,module,exports){
// clone
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple cloning device for basic objects and arrays

// API is the function. Use via
//   const clone = require(pathToClone)
// or
//   const {shallowCopy, shallowCopyObjectIfSame} = require(pathToClone)

module.exports = clone;
Object.assign(clone, {
  shallowCopy,
  shallowCopyObjectIfSame
})

function clone(val) {
  if (Array.isArray(val)) return cloneArray(val);
  if (typeof val == "object") return cloneObject(val);
  return val;
}

function cloneArray(array) {
  const ret = [];
  for (let index = 0; index < array.length; index++) {
    const child = array[index];
    ret.push(Array.isArray(child) ? cloneArray(child) : typeof child == "object" ? cloneObject(child) : child);
  }
  return ret;
}

function cloneObject(obj) {
  const ret = {},
    keys = Object.keys(obj);
  // I'm under the belief that this is ever so slightly quicker than had I used forEach
  // I might well be wrong but it's my hill and I'm holding it
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const key = keys[keyIndex],
      value = obj[key];
    ret[key] = Array.isArray(value) ? cloneArray(value) : typeof value == "object" ? cloneObject(value) : value;
  }
  return ret;
}


// copy first layer of an array of object
function shallowCopy(val) {
  if (Array.isArray(val)) return val.slice();
  else if (typeof val == "object") {
    const copy = {};
    for (const key in val)
      if (val.hasOwnProperty(key)) {
        copy[key] = val[key];
      }
    return copy;
  } else return val;
}

// returns a copy of immutableChild if an object, or {} if not, as mutableParent[key]
// Assumes that mutableParent[key] is already a copy of immutableChild if it exists.
// This is used by the SharedState module
function shallowCopyObjectIfSame(immutableChild, mutableParent, key) {
  if (typeof immutableChild != "object") {
    if (typeof mutableParent[key] != "object") mutableParent[key] = {};
  } else if (typeof mutableParent[key] != "object" || mutableParent[key] === immutableChild) {
    mutableParent[key] = shallowCopy(immutableChild);
  }
  return mutableParent[key];
}
},{}],11:[function(require,module,exports){
// diff
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple diff generator
// It is used by the SharedState module.
// output is a fairly custom format
//  for example
// diffAny({a:1,b:[2,1]},{b:[1],c:2})
// ==
// {
//   objectDiff: {
//     a: undefined,
//     b: {arrayDiff:[
//       { at: 0, value: 1 }
//       { deleteAt: 1 }
//     ]},
//     c: {value: 2}
//   }
// }

// API is the function. Use via
//   const diffAny = require(pathToDiff)

module.exports = diffAny;

function diffAny(was, is) {
  if (was === is) return;
  if (Array.isArray(is)) return diffArray(Array.isArray(was) ? was : undefined, is);
  if (typeof is == "object") return diffObject(typeof was == "object" ? was : undefined, is);
  if (typeof was == typeof is && was == is) return;
  return {
    value: is
  };
}

function diffObject(was, is) {
  let diff;
  if (was) {
    for (const key in was) {
      if (was.hasOwnProperty(key)) {
        if (!is.hasOwnProperty(key)) {
          if (!diff) diff = {};
          diff[key] = undefined;
          continue;
        }
        const wasChild = was[key],
          isChild = is[key],
          diffChild = diffAny(wasChild, isChild);

        if (diffChild) {
          if (!diff) diff = {};
          diff[key] = diffChild;
        }
      }
    }
  }

  for (const key in is) {
    if (is.hasOwnProperty(key) && !(was && was.hasOwnProperty(key))) {
      const isChild = is[key];

      if (!diff) diff = {};
      diff[key] = {
        value: isChild
      };
    }
  }
  return diff
    ? {
        objectDiff: diff
      }
    : undefined;
}

function diffArray(was, is) {
  let diff;
  // TODO better diff algorithm
  let index;
  for (index = 0; index < was.length && index < is.length; index++) {
    const wasChild = was[index],
      isChild = is[index],
      diffChild = diffAny(wasChild, isChild);

    if (diffChild) {
      if (!diff)
        diff = {
          arrayDiff: []
        };
      diff.arrayDiff.push(
        Object.assign(diffChild, {
          at: index
        })
      );
    }
  }
  for (index = was.length - 1; index >= is.length; index--) {
    const wasChild = was[index],
      diffChild = diffAny(wasChild);

    if (diffChild) {
      if (!diff)
        diff = {
          arrayDiff: []
        };
      diff.arrayDiff.push({
        deleteAt: index
      });
    }
  }
  for (index = is.length - 1; index >= was.length; index--) {
    const isChild = is[index];

    if (!diff)
      diff = {
        arrayDiff: []
      };
    diff.arrayDiff.push(
      Object.assign({
        insertAt: was.length,
        value: isChild
      })
    );
  }

  return diff;
}

},{}],12:[function(require,module,exports){
// convert_ids
// © Will Smart 2018. Licence: MIT

// PublicApi wraps a given class in a function that mimics the class's public methods
// essentially it allows js to support private methods/properties on a class
// I am sure this is available in other modules, this is just my version.

// To use, create a class, and provide a static method called publicMethods that returns an array of strings
// eg.

// class MyPrivateClass {
//   static publicMethods() {
//     return [
//       'publicMethod',
//       'publicGetter',
//       'publicStaticMethod'
//     ]
//   }
//   publicMethod() {this.privateMethod()}
//   privateMethod() {}
//   get publicGetter() {return `It's ${this.privateGetter}`}
//   get privateGetter() {return '42'}
//   static publicStaticMethod() {this.privateStaticMethod()}
//   static privateStaticMethod() {}
// }
//
// Essentially returns a class exposing only the public methods from MyPrivateClass
// const PublicInterface = PublicApi({fromClass:MyPrivateClass})
//
// or allowing instances of PublicInterface to have a '__private' property
//  which points to the underlying MyPrivateClass thus potentially easing debugging
//  and making instance construction a little quicker and instance size a little smaller
// const PublicInterface = PublicApi({fromClass:MyPrivateClass, hasExposedBackDoor:true})
//
// Use PublicInterface like a class
// const blic = new PublicInterface()
// blic.publicGetter == "It's 42"
// blic.privateGetter == undefined

// note that setters aren't supported as yet

// API is the class wrapping function. include as
// const PublicApi = require(pathToFile)
module.exports = PublicApi;

// simple function to wrap a class, exposing only the public interface to outsiders
function PublicApi({ fromClass, hasExposedBackDoor }) {
  const publicInstanceMethods = [],
    publicInstanceGetterMethods = [];

  fromClass.publicMethods().forEach(methodName => {
    if (fromClass.prototype.__lookupGetter__(methodName)) {
      let method = fromClass.prototype.__lookupGetter__(methodName);
      publicInstanceGetterMethods.push({ methodName, method });
    } else if (fromClass.prototype[methodName]) {
      let method = fromClass.prototype[methodName];
      publicInstanceMethods.push({ methodName, method });
    }
  });

  const PublicClass = function(arguments = {}) {
    const private = new fromClass(arguments);
    private.publicApi = this;

    if (hasExposedBackDoor) this.__private = private;
    else {
      publicInstanceGetterMethods.forEach(({ methodName, method }) => {
        this.__defineGetter__(methodName, function() {
          return method.apply(private, arguments);
        });
      });
      publicInstanceMethods.forEach(({ methodName, method }) => {
        this[methodName] = function() {
          return method.apply(private, arguments);
        };
      });
    }
  };

  fromClass.publicMethods().forEach(methodName => {
    if (fromClass.__lookupGetter__(methodName)) {
      let method = fromClass.__lookupGetter__(methodName);
      PublicClass.__defineGetter__(methodName, function() {
        return method.apply(fromClass, arguments);
      });
    } else if (fromClass[methodName]) {
      let method = fromClass[methodName];
      PublicClass[methodName] = function() {
        return method.apply(fromClass, arguments);
      };
    }

    publicInstanceGetterMethods.forEach(({ methodName, method }) => {
      PublicClass.prototype.__defineGetter__(methodName, function() {
        return method.apply(this.__private, arguments);
      });
    });
    publicInstanceMethods.forEach(({ methodName, method }) => {
      PublicClass.prototype[methodName] = function() {
        return method.apply(this.__private, arguments);
      };
    });
  });

  return PublicClass;
}

},{}],13:[function(require,module,exports){
// watchable
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple observer pattern util

// API is the function. Require via
//   const makeClassWatchable = require(pathToFile)
// then after creating your class use as:
//   makeClassWatchable(TheClass)

module.exports = makeClassWatchable;

let g_nextUniqueCallbackIndex = 1

function uniqueCallbackKey() {
  return `callback__${g_nextUniqueCallbackIndex++}`;
}

function makeClassWatchable(watchableClass) {
  Object.assign(watchableClass.prototype, {
    watch: function (listener) {
      const me = this;
      if (!listener.callbackKey) listener.callbackKey = uniqueCallbackKey();
      if (me.listeners === undefined) {
        me.listeners = [listener]
        if (typeof (me.firstListenerAdded) == 'function') {
          me.firstListenerAdded.call(me)
        }
      } else {
        let index = me.listeners.findIndex(listener2 => listener.callbackKey == listener2.callbackKey)
        if (index == -1) me.listeners.push(listener);
        else me.listeners[index] = listener
      }
      return listener.callbackKey;
    },

    stopWatching: function ({
      callbackKey
    }) {
      const me = this;

      if (!me.listeners) return;
      let index = me.listeners.findIndex(listener => listener.callbackKey == callbackKey)
      if (index == -1) return
      const listener = me.listeners.splice(index, 1)[0]
      if (!me.listeners.length) {
        delete me.listeners;
        if (typeof (me.lastListenerRemoved) == 'function') {
          me.lastListenerRemoved.call(me)
        }
      }
      return listener
    },

    forEachListener: function (type, callback) {
      const me = this;

      if (!me.listeners) return;
      if (!me.listeners.length) {
        delete me.listeners;
        return;
      }

      for (const listener of me.listeners) {
        if (typeof (listener[type]) == 'function') callback.call(me, listener)
      }
    },

    notifyListeners: function (type, ...args) {
      const me = this;
      me.forEachListener(type, listener => listener[type].apply(me, args))
    }
  })
}
},{}],14:[function(require,module,exports){
var upperCase = require('upper-case')
var noCase = require('no-case')

/**
 * Camel case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale, mergeNumbers) {
  var result = noCase(value, locale)

  // Replace periods between numeric entities with an underscore.
  if (!mergeNumbers) {
    result = result.replace(/ (?=\d)/g, '_')
  }

  // Replace spaces between words with an upper cased character.
  return result.replace(/ (.)/g, function (m, $1) {
    return upperCase($1, locale)
  })
}

},{"no-case":24,"upper-case":36}],15:[function(require,module,exports){
exports.no = exports.noCase = require('no-case')
exports.dot = exports.dotCase = require('dot-case')
exports.swap = exports.swapCase = require('swap-case')
exports.path = exports.pathCase = require('path-case')
exports.upper = exports.upperCase = require('upper-case')
exports.lower = exports.lowerCase = require('lower-case')
exports.camel = exports.camelCase = require('camel-case')
exports.snake = exports.snakeCase = require('snake-case')
exports.title = exports.titleCase = require('title-case')
exports.param = exports.paramCase = require('param-case')
exports.header = exports.headerCase = require('header-case')
exports.pascal = exports.pascalCase = require('pascal-case')
exports.constant = exports.constantCase = require('constant-case')
exports.sentence = exports.sentenceCase = require('sentence-case')
exports.isUpper = exports.isUpperCase = require('is-upper-case')
exports.isLower = exports.isLowerCase = require('is-lower-case')
exports.ucFirst = exports.upperCaseFirst = require('upper-case-first')
exports.lcFirst = exports.lowerCaseFirst = require('lower-case-first')

},{"camel-case":14,"constant-case":16,"dot-case":17,"header-case":18,"is-lower-case":19,"is-upper-case":20,"lower-case":23,"lower-case-first":22,"no-case":24,"param-case":28,"pascal-case":29,"path-case":30,"sentence-case":31,"snake-case":32,"swap-case":33,"title-case":34,"upper-case":36,"upper-case-first":35}],16:[function(require,module,exports){
var upperCase = require('upper-case')
var snakeCase = require('snake-case')

/**
 * Constant case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return upperCase(snakeCase(value, locale), locale)
}

},{"snake-case":32,"upper-case":36}],17:[function(require,module,exports){
var noCase = require('no-case')

/**
 * Dot case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '.')
}

},{"no-case":24}],18:[function(require,module,exports){
var noCase = require('no-case')
var upperCase = require('upper-case')

/**
 * Header case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '-').replace(/^.|-./g, function (m) {
    return upperCase(m, locale)
  })
}

},{"no-case":24,"upper-case":36}],19:[function(require,module,exports){
var lowerCase = require('lower-case')

/**
 * Check if a string is lower case.
 *
 * @param  {String}  string
 * @param  {String}  [locale]
 * @return {Boolean}
 */
module.exports = function (string, locale) {
  return lowerCase(string, locale) === string
}

},{"lower-case":23}],20:[function(require,module,exports){
var upperCase = require('upper-case')

/**
 * Check if a string is upper case.
 *
 * @param  {String}  string
 * @param  {String}  [locale]
 * @return {Boolean}
 */
module.exports = function (string, locale) {
  return upperCase(string, locale) === string
}

},{"upper-case":36}],21:[function(require,module,exports){
(function (global){
// https://github.com/maxogden/websocket-stream/blob/48dc3ddf943e5ada668c31ccd94e9186f02fafbd/ws-fallback.js

var ws = null

if (typeof WebSocket !== 'undefined') {
  ws = WebSocket
} else if (typeof MozWebSocket !== 'undefined') {
  ws = MozWebSocket
} else if (typeof global !== 'undefined') {
  ws = global.WebSocket || global.MozWebSocket
} else if (typeof window !== 'undefined') {
  ws = window.WebSocket || window.MozWebSocket
} else if (typeof self !== 'undefined') {
  ws = self.WebSocket || self.MozWebSocket
}

module.exports = ws

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],22:[function(require,module,exports){
var lowerCase = require('lower-case')

/**
 * Lower case the first character of a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  if (str == null) {
    return ''
  }

  str = String(str)

  return lowerCase(str.charAt(0), locale) + str.substr(1)
}

},{"lower-case":23}],23:[function(require,module,exports){
/**
 * Special language-specific overrides.
 *
 * Source: ftp://ftp.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
 *
 * @type {Object}
 */
var LANGUAGES = {
  tr: {
    regexp: /\u0130|\u0049|\u0049\u0307/g,
    map: {
      '\u0130': '\u0069',
      '\u0049': '\u0131',
      '\u0049\u0307': '\u0069'
    }
  },
  az: {
    regexp: /[\u0130]/g,
    map: {
      '\u0130': '\u0069',
      '\u0049': '\u0131',
      '\u0049\u0307': '\u0069'
    }
  },
  lt: {
    regexp: /[\u0049\u004A\u012E\u00CC\u00CD\u0128]/g,
    map: {
      '\u0049': '\u0069\u0307',
      '\u004A': '\u006A\u0307',
      '\u012E': '\u012F\u0307',
      '\u00CC': '\u0069\u0307\u0300',
      '\u00CD': '\u0069\u0307\u0301',
      '\u0128': '\u0069\u0307\u0303'
    }
  }
}

/**
 * Lowercase a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  var lang = LANGUAGES[locale]

  str = str == null ? '' : String(str)

  if (lang) {
    str = str.replace(lang.regexp, function (m) { return lang.map[m] })
  }

  return str.toLowerCase()
}

},{}],24:[function(require,module,exports){
var lowerCase = require('lower-case')

var NON_WORD_REGEXP = require('./vendor/non-word-regexp')
var CAMEL_CASE_REGEXP = require('./vendor/camel-case-regexp')
var CAMEL_CASE_UPPER_REGEXP = require('./vendor/camel-case-upper-regexp')

/**
 * Sentence case a string.
 *
 * @param  {string} str
 * @param  {string} locale
 * @param  {string} replacement
 * @return {string}
 */
module.exports = function (str, locale, replacement) {
  if (str == null) {
    return ''
  }

  replacement = typeof replacement !== 'string' ? ' ' : replacement

  function replace (match, index, value) {
    if (index === 0 || index === (value.length - match.length)) {
      return ''
    }

    return replacement
  }

  str = String(str)
    // Support camel case ("camelCase" -> "camel Case").
    .replace(CAMEL_CASE_REGEXP, '$1 $2')
    // Support odd camel case ("CAMELCase" -> "CAMEL Case").
    .replace(CAMEL_CASE_UPPER_REGEXP, '$1 $2')
    // Remove all non-word characters and replace with a single space.
    .replace(NON_WORD_REGEXP, replace)

  // Lower case the entire string.
  return lowerCase(str, locale)
}

},{"./vendor/camel-case-regexp":25,"./vendor/camel-case-upper-regexp":26,"./vendor/non-word-regexp":27,"lower-case":23}],25:[function(require,module,exports){
module.exports = /([a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0561-\u0587\u13F8-\u13FD\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7B5\uA7B7\uA7FA\uAB30-\uAB5A\uAB60-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19])([A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A])/g

},{}],26:[function(require,module,exports){
module.exports = /([A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A])([A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A][a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0561-\u0587\u13F8-\u13FD\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7B5\uA7B7\uA7FA\uAB30-\uAB5A\uAB60-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A])/g

},{}],27:[function(require,module,exports){
module.exports = /[^A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]+/g

},{}],28:[function(require,module,exports){
var noCase = require('no-case')

/**
 * Param case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '-')
}

},{"no-case":24}],29:[function(require,module,exports){
var camelCase = require('camel-case')
var upperCaseFirst = require('upper-case-first')

/**
 * Pascal case a string.
 *
 * @param  {string}  value
 * @param  {string}  [locale]
 * @param  {boolean} [mergeNumbers]
 * @return {string}
 */
module.exports = function (value, locale, mergeNumbers) {
  return upperCaseFirst(camelCase(value, locale, mergeNumbers), locale)
}

},{"camel-case":14,"upper-case-first":35}],30:[function(require,module,exports){
var noCase = require('no-case')

/**
 * Path case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '/')
}

},{"no-case":24}],31:[function(require,module,exports){
var noCase = require('no-case')
var upperCaseFirst = require('upper-case-first')

/**
 * Sentence case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return upperCaseFirst(noCase(value, locale), locale)
}

},{"no-case":24,"upper-case-first":35}],32:[function(require,module,exports){
var noCase = require('no-case')

/**
 * Snake case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '_')
}

},{"no-case":24}],33:[function(require,module,exports){
var upperCase = require('upper-case')
var lowerCase = require('lower-case')

/**
 * Swap the case of a string. Manually iterate over every character and check
 * instead of replacing certain characters for better unicode support.
 *
 * @param  {String} str
 * @param  {String} [locale]
 * @return {String}
 */
module.exports = function (str, locale) {
  if (str == null) {
    return ''
  }

  var result = ''

  for (var i = 0; i < str.length; i++) {
    var c = str[i]
    var u = upperCase(c, locale)

    result += u === c ? lowerCase(c, locale) : u
  }

  return result
}

},{"lower-case":23,"upper-case":36}],34:[function(require,module,exports){
var noCase = require('no-case')
var upperCase = require('upper-case')

/**
 * Title case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale).replace(/^.| ./g, function (m) {
    return upperCase(m, locale)
  })
}

},{"no-case":24,"upper-case":36}],35:[function(require,module,exports){
var upperCase = require('upper-case')

/**
 * Upper case the first character of a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  if (str == null) {
    return ''
  }

  str = String(str)

  return upperCase(str.charAt(0), locale) + str.substr(1)
}

},{"upper-case":36}],36:[function(require,module,exports){
/**
 * Special language-specific overrides.
 *
 * Source: ftp://ftp.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
 *
 * @type {Object}
 */
var LANGUAGES = {
  tr: {
    regexp: /[\u0069]/g,
    map: {
      '\u0069': '\u0130'
    }
  },
  az: {
    regexp: /[\u0069]/g,
    map: {
      '\u0069': '\u0130'
    }
  },
  lt: {
    regexp: /[\u0069\u006A\u012F]\u0307|\u0069\u0307[\u0300\u0301\u0303]/g,
    map: {
      '\u0069\u0307': '\u0049',
      '\u006A\u0307': '\u004A',
      '\u012F\u0307': '\u012E',
      '\u0069\u0307\u0300': '\u00CC',
      '\u0069\u0307\u0301': '\u00CD',
      '\u0069\u0307\u0303': '\u0128'
    }
  }
}

/**
 * Upper case a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  var lang = LANGUAGES[locale]

  str = str == null ? '' : String(str)

  if (lang) {
    str = str.replace(lang.regexp, function (m) { return lang.map[m] })
  }

  return str.toUpperCase()
}

},{}],37:[function(require,module,exports){
const PublicApi = require("./general/public-api");

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const callbackKey = 'ClientDatapoints'

class WSClientDatapoints {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({
    client,
    serverDatapoints,
    index
  }) {
    const clientDatapoints = this;

    clientDatapoints.serverDatapoints = serverDatapoints
    clientDatapoints.index = index
    clientDatapoints.subscribedDatapoints = {}
    clientDatapoints.diffByDatapointId = {}
    clientDatapoints.newlyValidDatapoints = {}
    clientDatapoints.clientDatapointVersions = {}

    clientDatapoints.sendMessage = (string) => client.sendMessage(string)
    clientDatapoints.sendPayload = ({
      messageIndex,
      messageType,
      payloadObject
    }) => {
      client.sendPayload({
        messageIndex,
        messageType,
        payloadObject
      })
    }

    client.watch({
      callbackKey,
      onclose: () => clientDatapoints.close(),
      onpayload: (args) => clientDatapoints.handlePayload(args),
    })
  }

  get callbackKey() {
    return `${callbackKey}_${this.index}`
  }

  close() {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints;

    for (const datapoint of Object.values(clientDatapoints.subscribedDatapoints)) {
      datapoint.stopWatching({
        callbackKey: clientDatapoints.callbackKey
      })
      serverDatapoints.releaseRefForDatapoint(datapoint)
    }
    clientDatapoints.subscribedDatapoints = {}
    clientDatapoints.diffByDatapointId = {}
    clientDatapoints.newlyValidDatapoints = {}
    clientDatapoints.clientDatapointVersions = {}
    delete serverDatapoints.clientsWithPayloads[clientDatapoints.index]
  }

  subscribe({
    datapointId
  }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints;

    if (clientDatapoints.subscribedDatapoints[datapointId]) return clientDatapoints.subscribedDatapoints[datapointId];

    const {
      datapoint
    } = serverDatapoints.addRefForDatapoint({
      datapointId
    })

    clientDatapoints.subscribedDatapoints[datapointId] = datapoint

    datapoint.watch({
      callbackKey: clientDatapoints.callbackKey,
      onvalid: () => {
        clientDatapoints.queueSendDiff(datapoint)
      }
    })



    clientDatapoints.queueSendDiff(datapoint)
  }

  unsubscribe({
    datapointId
  }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      datapoint = clientDatapoints.subscribedDatapoints[datapointId]

    if (!datapoint) return;

    delete clientDatapoints.subscribedDatapoints[datapointId]

    datapoint.stopWatching({
      callbackKey: clientDatapoints.callbackKey,
    })
    serverDatapoints.releaseRefForDatapoint(datapoint)
  }

  queueSendDiff(datapoint) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      datapointId = datapoint.datapointId;

    if (clientDatapoints.diffByDatapointId[datapointId]) return

    const clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId],
      {
        sentVersion = 0,
        hasVersion = 0
      } = clientVersionInfo || {}

    if (sentVersion != hasVersion) return

    const diff = serverDatapoints.diffForDatapoint({
      datapointId,
      value: datapoint.valueIfAny,
      fromVersion: hasVersion
    })
    if (!diff) return

    if (clientVersionInfo) clientVersionInfo.sentVersion = diff.toVersion;
    else clientDatapoints.clientDatapointVersions[datapointId] = {
      hasVersion,
      sentVersion: diff.toVersion
    }
    clientDatapoints.diffByDatapointId[datapointId] = diff
    serverDatapoints.clientsWithPayloads[clientDatapoints.index] = clientDatapoints

    return diff
  }

  handlePayload({
    messageIndex,
    messageType,
    payloadObject,
  }) {
    const clientDatapoints = this

    if (payloadObject.datapoints) clientDatapoints.recievedDatapointsFromClient(payloadObject)
  }

  recievedDatapointsFromClient({
    datapoints: datapointsFromClient
  }) {
    const clientDatapoints = this

    for (let [datapointId, datapointFromClient] of Object.entries(datapointsFromClient)) {
      if (datapointFromClient === 0) datapointFromClient = {
        unsubscribe: true
      }
      else if (datapointFromClient === 1) datapointFromClient = {
        subscribe: true
      }
      const subscribedDatapoint = clientDatapoints.subscribedDatapoints[datapointId],
        {
          ackVersion,
          unsubscribe,
          subscribe,
          diff
        } = datapointFromClient

      if (subscribedDatapoint) {
        if (unsubscribe) {
          clientDatapoints.unsubscribe({
            datapointId
          })
          continue
        }
        if (ackVersion) {
          let clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId]
          const {
            hasVersion = 0
          } = clientVersionInfo || {}

          if (hasVersion != ackVersion) {
            if (!clientVersionInfo) clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId] = {
              hasVersion: ackVersion,
              sentVersion: ackVersion
            };
            else clientVersionInfo.hasVersion = ackVersion

            clientDatapoints.queueSendDiff(subscribedDatapoint)
          }
        }
        if (diff) {
          // TODO
        }
      } else if (subscribe) {
        clientDatapoints.subscribe({
          datapointId
        })
      }
    }
  }
}

class WSServerDatapoints {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({
    wsserver
  }) {
    const serverDatapoints = this

    serverDatapoints._cache = wsserver.cache
    serverDatapoints.clientsWithPayloads = {}
    serverDatapoints.nextClientIndex = 1
    serverDatapoints.payloadByFromVersionByDatapointId = {}
    serverDatapoints.datapointInfos = {}

    wsserver.watch({
      callbackKey,
      onclientConnected: (client) => client.datapoints = new WSClientDatapoints({
        serverDatapoints,
        client,
        index: serverDatapoints.nextClientIndex++
      })
    })

    serverDatapoints.cache.watch({
      callbackKey,
      onvalid: () => {
        serverDatapoints.sendPayloadsToClients()
      }
    })
  }

  get cache() {
    return this._cache
  }

  addRefForDatapoint({
    datapointId
  }) {
    const serverDatapoints = this,
      datapoint = serverDatapoints.cache.getOrCreateDatapoint({
        datapointId
      })

    let datapointInfo = serverDatapoints.datapointInfos[datapointId]
    if (datapointInfo) {
      datapointInfo.refCnt++
    } else {
      datapointInfo = serverDatapoints.datapointInfos[datapointId] = {
        datapoint,
        refCnt: 1,
        currentVersion: datapoint.invalid ? 0 : 1
      }

      datapoint.watch({
        callbackKey,
        onvalid_prioritized: () => {
          datapointInfo.currentVersion++
        }
      })

      if (datapoint.invalid) serverDatapoints.cache.queueValidationJob()
    }
    return datapointInfo
  }

  releaseRefForDatapoint({
    datapointId
  }) {
    const serverDatapoints = this

    let datapointInfo = serverDatapoints.datapointInfos[datapointId]
    if (datapointInfo && !--datapointInfo.refCnt) {
      datapointInfo.datapoint.stopWatching({
        callbackKey
      })
      delete serverDatapoints.datapointInfos[datapointId]
      return
    }
    return datapointInfo
  }

  queueValidateJob() {
    const serverDatapoints = this


  }
  diffForDatapoint({
    datapointId,
    value,
    fromVersion
  }) {
    const serverDatapoints = this,
      payloadByFromVersion = serverDatapoints.payloadByFromVersionByDatapointId[datapointId] ?
      serverDatapoints.payloadByFromVersionByDatapointId[datapointId] :
      (serverDatapoints.payloadByFromVersionByDatapointId[datapointId] = {})

    if (payloadByFromVersion[fromVersion]) return payloadByFromVersion[fromVersion];

    const datapointInfo = serverDatapoints.datapointInfos[datapointId] || {},
      {
        currentVersion = 0
      } = datapointInfo

    if (currentVersion <= fromVersion) return;

    // TODO handle diff for recent version
    return payloadByFromVersion[fromVersion] = (datapointInfo.datapoint || {}).valueIfAny
  }

  sendPayloadsToClients() {
    const serverDatapoints = this

    const clientsWithPayloads = serverDatapoints.clientsWithPayloads;
    serverDatapoints.clientsWithPayloads = {}
    serverDatapoints.payloadByFromVersionByDatapointId = {}

    for (const clientDatapoints of Object.values(clientsWithPayloads)) {
      const newlyValidDatapoints = clientDatapoints.newlyValidDatapoints;
      clientDatapoints.newlyValidDatapoints = {}

      const diffByDatapointId = clientDatapoints.diffByDatapointId
      clientDatapoints.diffByDatapointId = {}

      try {
        clientDatapoints.sendPayload({
          messageType: "Models",
          payloadObject: {
            diffs: diffByDatapointId
          }
        });
      } catch (err) {
        console.log(err);
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WSServerDatapoints,
  hasExposedBackDoor: true
});
},{"./general/public-api":12}]},{},[3]);
