// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const DatapointCache = require('../../cache/datapoint-cache');

module.exports = () => {}; /*async function(rig) {
  rig.startTask('DatapointCache tests');
  const datapointCache = new DatapointCache(rig);

  const datapointIds = {
    name: 'app__1__name',
    appDom: 'app__1__dom',
    appTemplate: 'app__1__template',
    templateDom: 'template__1__dom',
    appDomWithVariant: 'app__1__dom_variant',
  };
  const expectedValues = {
    name: '1 app name',
    appDom: '1 template dom',
    templateDom: '1 template dom',
    appDomWithVariant: '1 template dom',
  };

  const datapoints = {};
  for (const [key, datapointId] of Object.entries(datapointIds)) {
    datapoints[key] = datapointCache.getOrCreateDatapoint(datapointId);
    datapoints[key].watch({});
  }

  await datapointCache.validateNewlyInvalidDatapoints();
  await datapointCache.validateNewlyInvalidDatapoints();
  await datapointCache.validateNewlyInvalidDatapoints();

  for (const [key, expectedValue] of Object.entries(expectedValues)) {
    rig.assert(`The value of datapoint '${datapoints[key].datapointId}' is correct`, datapoints[key].valueIfAny, {
      equals: expectedValue,
    });
  }

  rig.endTask();
};
*/
