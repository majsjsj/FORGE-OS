# Security Policy

Report vulnerabilities privately through GitHub Security Advisories rather than public issues.

Current controls: workspace-scoped file operations, blocked common secret files and dependency directories, file size limits, no arbitrary shell tool, and pytest timeout.

Important: pytest executes repository code. Use disposable containers for untrusted repositories. This MVP is not designed as a public multi-tenant service.
