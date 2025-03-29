---
title: Copying and Hiding Files with VFS Overlays
---

Clang and LLVM have a mechanism called a virtual filesystem overlay
(VFS Overlay) that allows someone to change the layout of the filesystem from
the view of the compiler without actually changing anything on disk. This is
useful when you need to place files on read-only filesystems, or when you don't
actually want to move files on disk.

Unfortunately, they are almost completely undocumented, making it difficult to
find resources on how to write and use a VFS overlay. This article contains some
examples on how to use VFS overlays to manipulate the filesystem. For more
information, the best documentation is a comment in the
[LLVM sources](https://github.com/llvm/llvm-project/blob/d66af9c69b6960ad5f903cc6c0db99395dace6af/llvm/include/llvm/Support/VirtualFileSystem.h#L677-L776).

## Copying A File

The first example will copy a header file. The filesystem will start with two
files, `header.h` and `main.c`

```c
// header.h
#warning "Hello!"
```

```c
// main.c
#include "header.h"
#include "a.h"
```

If we compile it now, we get the warning when we import `header.h`, and a fatal
error because there is no file `a.h`, so the `#include "a.h"` fails.

```sh
%  clang -fsyntax-only main.c
In file included from main.c:2:
./header.h:2:2: warning: "Hello!" [-W#warnings]
    1 | #warning "Hello!"
      |  ^
main.c:3:10: fatal error: 'a.h' file not found
    2 | #include "a.h"
      |          ^~~~~
1 warning and 1 error generated.
```

To fix this, we create a vfs overlay, which is a yaml file.

The following overlay creates a copy of `header.h` called `a.h`.

```yaml
# overlay.yml
---
version: 0
root-relative: overlay-dir
roots:
  - type: directory
    name: .
    contents:
      - type: file
        name: a.h
        external-contents: header.h
```

Currently, LLVM only supports version 0, so the version is always zero.
The `root-relative` option specifies whether relative paths are relative to the
directory where the compiler was invoked, or to the location of the VFS overlay
file. By default, it is relative to the directory where the compiler is invoked.

All overlays require a list of filesystem "roots". This refers to where the
virtual file will end up living, not where the existing file is rooted. In this
example, both `header.h`, the `overlay.yml`, and `main.c` all live in the same
directory, so the root is the current directory, indicated by the `name: .`
field.

This example has one entry, a file entry, which creates a file at a location
relative to the current root. The `name` field defines the name of the file, and
the `external-contents` field defines the name of the file that we are copying.

Now when we run it, we get the expected two warnings.

```sh
%  clang -fsyntax-only -ivfsoverlay overlay.yml main.c
In file included from main.c:2:
./header.h:2:2: warning: "Hello!" [-W#warnings]
    1 | #warning "Hello!"
      |  ^
In file included from main.c:3:
./header.h:2:2: warning: "Hello!" [-W#warnings]
    1 | #warning "Hello!"
      |  ^
2 warnings generated.
```

You'll note that the warning message calls both file imports `header.h` instead
of referring to the second include by the overlaid `a.h`. This makes it easier
to track down the actual file name where an error message originated from.

If we want to place the copied file under a subdirectory, we can add a second,
directory entry, under our root.

```yaml
# overlay.yml
---
version: 0
root-relative: overlay-dir
roots:
  - type: directory
    name: .
    contents:
      - type: file
        name: a.h
        external-contents: header.h
      - type: directory
        name: include
        contents:
          - type: file
            name: b.h
            external-contents: header.h
```

Then we modify `main.c` to include the virtual file `include/b.h`.

```c
// main.c
#include "header.h"
#include "a.h"
#include "include/b.h"
```

Now when we run clang, we have three warnings, all emitted by the same header.

```sh
%  clang -fsyntax-only -ivfsoverlay overlay.yml main.c -H
. ./header.h
In file included from main.c:2:
./header.h:2:2: warning: "Hello!" [-W#warnings]
    1 | #warning "Hello!"
      |  ^
. ./header.h
In file included from main.c:3:
./header.h:2:2: warning: "Hello!" [-W#warnings]
    1 | #warning "Hello!"
      |  ^
. ./header.h
In file included from main.c:4:
./header.h:2:2: warning: "Hello!" [-W#warnings]
    1 | #warning "Hello!"
      |  ^
3 warnings generated.
```

## Hiding Files

Sometimes it's necessary to hide a file, especially when working with clang
modules, which must have unique names. I won't get into those in this example.

We'll start with two files, `header.h` and `main.c` and use a VFS overlay to
hide `header.h`.

```c
// main.c
#include "header.h"
```

```c
// header.h
#warning "Hello!"
```

Running clang gives us the following warning.

```
%  clang -fsyntax-only  main.c
In file included from main.c:2:
./header.h:2:2: warning: "Hello!" [-W#warnings]
    2 | #warning "Hello!"
      |  ^
1 warning generated.
```

To mask out the header file, we set the name of the file to the file we are
hiding and the external contents to a file that doesn't exist, in this case
`NIL`.

```yaml
# overlay.yml
---
version: 0
root-relative: overlay-dir
roots:
  - type: directory
    name: .
    contents:
      - type: file
        name: header.h
        external-contents: NIL
```

Now when we run the compiler we get an error saying that the file `header.h`
does not exist.

```sh
%  clang -fsyntax-only -ivfsoverlay overlay.yml main.c
main.c:2:10: fatal error: 'header.h' file not found
    2 | #include "header.h"
      |          ^~~~~~~~~~
1 error generated.
```

If we set the external-contents to another file that does exist, the overlay
file will overlay on top of the existing file, effectively masking it out.
