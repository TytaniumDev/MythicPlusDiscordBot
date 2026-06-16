## 2024-06-16 - Environment Parity over SSH

**Insight:** Passing multiline strings across GitHub workflows into shell script heredocs requires explicit attention to string interpolation. Using unquoted `<< DEPLOY_SCRIPT` will interpolate variables locally on the CI runner, whereas `<< 'DEPLOY_SCRIPT'` defers execution strictly to the target host. When using extracted scripts over SSH, interpolation rules must match where the variables actually live (e.g., Doppler secrets are local to GH context, environment parsing must occur locally).

**Action:** When extracting SSH multiline scripts, be mindful of heredoc quoting logic so CI variables are not accidentally evaluated as blank on the remote server.
