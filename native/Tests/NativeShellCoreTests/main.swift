runTests([
  ("ServerReadinessDetector", testServerReadinessDetector),
  ("DisplayStateResolver", testDisplayStateResolver),
  ("DisplayStateResolverFailureStage", testDisplayStateResolverFailureStage),
  ("ServerLifecycleBinding", testServerLifecycleBinding),
  ("ServerLifecycleObservation", testServerLifecycleObservation),
  ("DiagnosticLogWriter", testDiagnosticLogWriter),
  ("ErrorDisplay", testErrorDisplay),
  ("BundleLayoutResolver", testBundleLayoutResolver),
  ("ContentRootResolver", testContentRootResolver),
  ("ContentRootReselect", testContentRootReselect),
  ("ErrorVisibilityRoot", testErrorVisibilityRoot),
])
