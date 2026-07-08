/// @vocab 失敗段階
/// 失敗がサーバー起動前に起きたのか、起動後に起きたのかの区別。
public enum FailureStage: Equatable {
  /// 起動失敗（サーバーが使える状態になる前に失敗した）
  case beforeStartup
  /// 起動後障害（いったん使える状態になった後に失敗した）
  case afterStartup
}
