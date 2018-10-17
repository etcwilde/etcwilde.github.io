---
title: To Merge Or Not To Merge, and the Consequences
---

LLVM and Linux have fairly different merging behaviour. LLVM uses an
SVN-style commit behaviour where things are pretty much committed
directly to the master branch after going through code review. This is
probably because the official LLVM repository is still hosted on SVN. In
contrast, the Linux repository uses merge commits quite heavily,
matching the organizational structure of Linux. Linus is the only author
with commit access to the master branch of the kernel repository. All
commits are merged into the master branch through Linus.
Linus usually merges commits coming from others who are managing certain
parts of the kernel, like Andrew Morton who focuses on the patches
related to the memory manager and David Miller, who usually handled the
networking subsystem. Under the merge from David Miller are usually
other merges, for example a wireless merge, which tends to be made by
John Linville. Then under that merge is usually a merge containing the
patches to mac80211, bluetooth, and the other wireless networking
technologies. The merge structure starts to form tree-like structures,
which progressively filter out unrelated commits. I describe these trees
in more detail in my [masters](http://venus.library.uvic.ca/bitstream/handle/1828/10053/Wilde_Evan_MSC_2018.pdf) thesis.

My aim in this is to look at the effect of the different merging
strategies on the commits in the repositories, looking at the number of
files modified per commit, and the number of lines changed. My guess is
that commits in LLVM will make changes to more files, and that more
lines will be edited per commit. This comes from the notion that each
commit is pushed directly into the master branch, and therefore should
probably be a complete, functioning patch. Conversely, commits made to
side-branches of the kernel do not need to leave the kernel in an
operating state, so long as the kernel is functioning by the time the
changes in commit are integrated. This makes it possible to make small,
incremental changes, leading up to something that works.

I have two main questions that I would like to try and answer here

 1. How does merge strategy effect the number of files touched per commit?
 2. How does merge strategy effect the line churn per commit?

It is important to note that these numbers do not necessarily reflect
how the engineers on these projects actually work, only the artifact
that is left behind after they've cleaned up their workspace and pushed
it out.

> Archaeology is the search for fact, not truth.
> -- Indiana Jones

So, lets get digging. This data was collected on October 7, 2018, from
the Linux and LLVM repositories. The HEAD of the Linux repository was
commit `7876320f88802b22d4e2daf7eb027dd14175a0f8`, and the HEAD of the
LLVM repository was `a2434c2657e24263fab58e864aea7fb0049daefd` at the
time of collection.

The database generated from the data initially contained a single table
containing information at a commit level. I had to add a new table
including the list of files that had been touched by the commit,
including the number of lines added and removed in that specific file.

The commits table schema:

| Commits       |                |                             |
|---------------+----------------+-----------------------------|
| cid           | CHARACTER (40) | Commit hash                 |
| created_at    | DATE           | When the commit was created |
| files_touched | INTEGER        | Number of files modified    |
| lines_added   | INTEGER        | Number of lines added       |
| lines_removed | INTEGER        | Number of lines removed     |
|               |                |                             |
| PRIMARY KEY   | cid            |                             |

The files table schema:

| Files       |                 |                                                      |
|-------------+-----------------+------------------------------------------------------|
| cid         | CHARACTER (40)  | Commit hash                                          |
| filename    | TEXT            | Name of the file                                     |
| added       | INTEGER         | Number of lines added to the file in this commit     |
| removed     | INTEGER         | Number of lines removed from the file in this commit |
|             |                 |                                                      |
| PRIMARY KEY | (cid, filename) |                                                      |

The files table is used to investigate the effect of the test-suite on
the number of files touched per commit, and the number of lines added
and removed per commit.

The commits in these tables do not include merge commits. I'm only
interested in counting the changes that happen in the non-merge commits.

# Background

It's a good idea to get an idea of what we're working with. How many
commits are in each repository, and how many files do they each contain?

```sql
attach 'llvm.db' as llvm;
attach 'linux.db' as linux;

SELECT 'linux' project, count(*) commits
FROM linux.commits
UNION
SELECT 'llvm' project, count(*) commits
FROM llvm.commits
ORDER BY  count(*) DESC;
```

| project | commits |
|---------+---------|
| linux   |  724890 |
| llvm    |  170283 |

Linux contains around 7 times more commits than LLVM.

The first commit to the Linux git repository contains all of the changes
that had been made to the kernel up to that point. Linus didn't include
the history prior to that point because, according to the commit log
message, it came out to around 3.2 Gb. This results in one large commit
being made on April 16, 2005. The first commit to LLVM was made on the
evening of June 6, 2001. Now, a clever eye might pick up on an issue
here. Git wasn't written until 2005, and I'm pretty sure Chris Lattner
doesn't own a time machine. The LLVM git repository actually just
imported all of the commits from the SVN repository. The git repository
is just a mirror, LLVM is still primarily hosted on SVN, so it makes
sense that the SVN history was kept.

The first log message actually comes from when LLVM moved from cvs to
svn.

    commit 8d0afd3d32d1d67f9aa5df250a1d6955aa8f1ac9
    Author: CVS to SVN Conversion <nobody@llvm.org>
    Date:   Wed Jun 6 20:29:01 2001 +0000

        New repository initialized by cvs2svn.

        git-svn-id: https://llvm.org/svn/llvm-project/llvm/trunk@1 91177308-0d34-0410-b5e6-96231b3b80d8

Next, how many files are in the repositories?

Well, to keep things short, we can just query it with `wc` to get
something close.

```sh
$ find linux/ -type f | wc -l
61769
$ find llvm/ -type f | wc -l
33359
```

We could track the commits through time, given that we do have the file
information, but it doesn't actually contribute anything extra, so I'm
just going to leave it there.

So Linux has roughly twice the number of files.
Just for fun, lets count the total number of lines in both projects.

```sh
$ find linux/ -type f | xargs cat | wc -l
41865049
$ find llvm/ -type f | xargs cat | wc -l
8738810
```

I can't say that I wasn't expecting huge numbers. Nearly 42 million in
Linux versus nearly 9 million lines in LLVM.

And to wrap things up here, lets look at how many people are involved in
these projects. This is a pretty rough estimate of the number. I'm just
using the author names from the commits. I'm using `%aN` instead of
`%an` which will respect the mail mapping if one exists and use the
email addresses to map back to a consistent name. Linux has a mailmap
file, LLVM does not.

```sh
$ git -C linux/ log --format='%aN' | sort | uniq | wc -l
19007
$ git -C llvm/ log --format='%aN' | sort | uniq | wc -l
976
```

Linux has a lot more contributors. Given this, I'm actually pretty
surprised that the number of lines in these projects is so similar.
On average, each author to Linux will have written around 2200 lines,
whereas that number is closer to 9000 lines contributed per author.
That's pretty neat.
This actually poses some new questions about contributor retention or
loyalty, but that's a story for another time.

LLVM and Linux have different testing patterns. LLVM is tested very
heavily, with nearly every change being accompanied with a change to a
test. This will impact the number of files changed and the number of
lines modified in a given commit. I'm not as familiar with the testing
patterns of Linux.

![Proportion of Test Files to Source Files Over Time]({{"assets/post_data/CommitBehaviour/test_ratio_file_distribution_over_time.svg" | relative_url}})

Here we see a comparison of the two projects, showing the proportion of
test to source files being changed on average in a given commit over
time. In 2005, Linux started with roughly 9 out of 10 files changed per commit.
In 2006, that number drops toward 8 of 10 files being source
files, and 2 being tests. Now, roughly 1/3 of the files in a commit are
changes to the tests, and the remaining 2/3 of the files in the commit
are to the source.

LLVM has a similar, but more extreme behaviour. In 2001, around 93% of
the files changed per commit were source files, with about 7% being to
the tests. Now, commits consist of _slightly_ more test files than
source files, with 50.04% of the files per commit being test, and 49.96%
being changes to test files. In 2017, source files still contributed
more to the number of files touched per commit than the tests, with
49.5% going to tests, and the 50.5% going to source.

This is just including the number of files being modified. It gives no
notion of how big the changes were in the two types of files.

![Proportion of Test Line Churn to Source Line Churn Over Time]({{"assets/post_data/CommitBehaviour/test_ratio_churn_distribution_over_time.svg" | relative_url}})

This plot looks at the proportion of where line churn is happening in
commits through the years. The behaviour is very similar to the file
touches. In 2005, Linux has a little over 13% of the line churn per
commit going to tests, while the remaining 87% goes to the functional
source. Looking forward to 2018, the split is roughly 1/3 test churn and
2/3 source churn.

LLVM is again far more extreme. In 2001, 2.3% of the line churn went to
test files, wile the other 98% went to the source. Looking forward to
2018, 59.7% of the line churn is made to the test suite, while the
remaining 40.3% is to source. 2012 was the last year where the churn in
the source contributed more to patches than the churn in the tests.
There was a big jump between 2005 and 2006, from 84% of the churn
contributing to the source files to 59% contributing to the source.

I just filter out any file where the world _test_ appears somewhere in
the file path. This also include other derivatives like _unittest_.

# Analysis

Okay, now that we know a little about the repositories, lets actually
start digging into the two main questions:

 1. How does merge strategy effect the number of files touched per commit?
 2. How does merge strategy effect the line churn per commit?

## Files Touched

Naively digging straight in, lets just plot it.

```R
library(RSQLite)
colorSchemeFill = c("#6ca1f7", "#f74747")
colorSchemeBorder= c("#3364b2", "#b23333")
linux_con <- dbConnect(drv=dbDriver('SQLite'), dbname='./linux.db')
llvm_con <- dbConnect(drv=dbDriver('SQLite'), dbname='./llvm.db')

svg("images/file_distribution.svg")
query <- "
SELECT cid,
       files_touched
FROM commits
WHERE files_touched <> 0;
"
linux_data <- dbGetQuery(linux_con, query);
llvm_data <- dbGetQuery(llvm_con, query)
boxplot(linux_data$files_touched, llvm_data$files_touched,
        col=colorSchemeFill,
        names=list('Linux', 'LLVM'),
        main="Distribution of Files Touched Per Commit",
        outline=F)
```

![File Distribution]({{"assets/post_data/CommitBehaviour/file_distribution.svg" | relative_url}})

```sql
.load './libs/libsqlitefunctions.so'
attach 'llvm.db' as llvm;
attach 'linux.db' as linux;

SELECT 'Linux' project,
			 count(*),
			 max(files_touched) max,
			 median(files_touched) median,
			 round(avg(files_touched), 3) avg,
			 min(files_touched) min
FROM linux.commits
UNION
SELECT 'LLVM' project,
			 count(*),
			 max(files_touched) max,
			 median(files_touched) median,
			 round(avg(files_touched), 3) avg,
			 min(files_touched) min
FROM llvm.commits;
```

| project | count(*) |   max | median |   avg | min |
|---------+----------+-------+--------+-------+-----|
| LLVM    |   170283 |  3931 |      1 | 3.377 |   0 |
| Linux   |   724890 | 17291 |      1 | 2.401 |   0 |


So in both cases, the median number of files touched per commit is 1.
In third quartile, commits touch 2 files in Linux and 3 files in LLVM.
Then in the fourth quartile, commits touch up to 3 files in Linux and up
to 6 files in LLVM. Well, case closed, we can all go home now.

Just kidding.

Lets look at the data from a few other angles and see what falls out.

![Distribution of Files Touched Per Commit Over Time]({{"assets/post_data/CommitBehaviour/file_distribution_over_time.svg" | relative_url}})

This plot shows the distribution of the number of files touched per
commit over time. Linux is very steady, with the median being 1, and the
top of the third quartile being 2 files touched. LLVM is quite
consistent from 2001 until 2011, with the same metrics. In 2013, the
median jumps up to 2, and the third quartile includes up to 3 files. The
median remains 2 until 2018. The third quartile actually reaches up
to 4 files in 2015, 2017, and 2018.

```sql
attach './linux.db' AS linux;
attach './llvm.db' AS llvm;

SELECT linux.files_touched 'Files Touched',
       linux.cnt 'Linux Count',
       llvm.cnt 'LLVM Count'
FROM
       (
       SELECT files_touched,
              count(*) cnt
       FROM llvm.commits
       GROUP BY files_touched
       ORDER BY files_touched,
                count(*)
       LIMIT 10) llvm
       JOIN
       (
       SELECT files_touched,
              count(*) cnt
       FROM linux.commits
       GROUP BY files_touched
       ORDER BY files_touched,
                count(*)
       LIMIT 10) linux
ON llvm.files_touched = linux.files_touched;
```

| Files Touched | Linux Count | LLVM Count |
|---------------+-------------+------------|
|             0 |          39 |        212 |
|             1 |      463629 |      87211 |
|             2 |      104924 |      36193 |
|             3 |       58589 |      14616 |
|             4 |       32650 |       8623 |
|             5 |       18923 |       5275 |
|             6 |       11515 |       3723 |
|             7 |        7548 |       2595 |
|             8 |        5196 |       1822 |
|             9 |        3595 |       1477 |

This table shows how many commits (Linux Count and LLVM Count) touch a
varying number of files. There are 39 commits in Linux that touch no
files, and 212 commits from LLVM. A lot of commits touch only a single
file in both repositories, and then it declines back down fairly
quickly.

![Distribution of how many commits touch a varying number of files]({{"assets/post_data/CommitBehaviour/file_commit_counts.svg" | relative_url}})

It appears that there is a fairly small difference between the two
distributions. Both distributions have very few 0-file commits, many
1-file commits, and then gradually reducing again.
Linux has a higher proportion of the commits touching a single file than
LLVM, but LLMV has a higher proportion of the commits touching two files.

I'm definitely interested in what is going on in the 0-file commits in
both repositories. These commits don't make up a noticeable part of the
commits, but there may be something of interest here. 0-file, or empty
commits are sometimes used for triggering CI systems, but I somehow
don't believe that they would be integrated into the kernel. At the very
least, Linus would probably ask that they be removed since they just
clutter the repository history.

The other question I have is about what is going on in the commits that
touch the most files. There are certain commits that, by design, will
touch a huge number of files. These might include formatting changes or
something of that nature. I'll try to see why the commit is touching
so many files, if there is a root cause.

Switching back, we know that the two projects have different testing
habits. I'm more interested in seeing the effects of merging on source
than on testing, and I'm pretty certain that with more than 50% of the
files touched going toward testing, it will have an impact on the
results. Lets take a look at the distributions with the test files
removed.

```R
library(RSQLite)

linux_con <- dbConnect(drv=dbDriver('SQLite'), dbname='./linux.db')
llvm_con <- dbConnect(drv=dbDriver('SQLite'), dbname='./llvm.db')

colorSchemeFill = c("#6ca1f7", "#f74747")
colorSchemeBorder= c("#3364b2", "#b23333")

query <- "
SELECT cid, count(*) files_touched
FROM files
WHERE filename NOT LIKE '%test%'
GROUP BY cid;
"

linux_data <- dbGetQuery(linux_con, query)
llvm_data <- dbGetQuery(llvm_con, query)

dbDisconnect(linux_con)
dbDisconnect(llvm_con)

svg("images/file_no_tests_distribution.svg")

boxplot(linux_data$files_touched, llvm_data$files_touched,
        col=colorSchemeFill,
        names=list('Linux', 'LLVM'),
        main="Distribution of Non-test Files Touched Per Commit",
        outline=F)
```

![Distribution of non-test files touched per commit]({{"assets/post_data/CommitBehaviour/file_no_tests_distribution.svg" | relative_url}})

When we remove the tests, the distributions of the two repositories look
the same. It appears that the test suite in LLVM is what is causing the
difference in the number of files touched per commit that we were seeing
before.

### Linux

The first thing that stands out to me is that in both cases is that
there are commits that reportedly don't touch any files. Given how Linus
likes to keep his repository clean, I kind of doubt that he would go
around allowing empty commits. Empty commits are sometimes useful for
triggering CI tasks or git hooks, but to my knowledge, the kernel
project doesn't have a CI system. So the question is, what is going on
with these commits?

| Commit Hash    | Created On | Notes          | Module            |
|----------------+------------+----------------+-------------------|
| c813d8e048740c | 2015-08-20 | Appears normal | drm/nouveau/bin   |
| 7aa86e5155a3c6 | 2014-04-08 | Appears normal | MIPS              |
| 2c5f5c9a1d1b35 | 2014-03-19 | Appears normal | selinux           |
| be0306bcc3a0b0 | 2013-07-23 | Merge          |                   |
| db27ac80792d31 | 2012-07-04 | Appears normal | arm/dts           |
| f52c44cd27b4a0 | 2012-06-10 | Merge          |                   |
| 8865abd090f106 | 2012-04-09 | Merge          |                   |
| 2eb6038c51034b | 2012-02-09 | Merge          |                   |
| a5e5c37434eb18 | 2011-11-22 | Appears normal | sctp              |
| 94b12d4481b3f3 | 2011-08-08 | Merge          |                   |
| f55cf3c76a3b2e | 2011-06-09 | Merge          |                   |
| 7ee4b98eca42c1 | 2011-03-17 | Appears normal | of/flattree       |
| efb3bb4fad062f | 2011-03-30 | Merge          |                   |
| c206e514771778 | 2011-02-24 | Appears normal | omap2+            |
| 3939b20f907676 | 2009-11-12 | Appears normal | RDMA/cxgb3        |
| 050cc1f568e896 | 2009-03-31 | Appears normal | i.MX31            |
| 4c6ed8f496fe89 | 2009-03-13 | Merge          |                   |
| d7f735d0bc68c4 | 2008-12-17 | Appears normal | Btrfs             |
| 43dd729b862f4a | 2008-11-20 | Appears normal | Btrfs             |
| d844222a54c33a | 2008-11-11 | Merge          |                   |
| 15c220d003f791 | 2008-10-11 | Appears normal | Memory Management |
| 4621d588e0e8b5 | 2008-07-03 | Appears normal | ARM/OMAP          |
| 3f662c6eaa9414 | 2008-07-03 | Appears normal | ARM OMAP DMA      |
| 249d621a85668b | 2008-02-09 | Merge          |                   |
| b39f4ce974114c | 2007-12-26 | Appears normal | Blackfin arch     |
| e31b6656a81d63 | 2007-10-16 | Appears normal | ALSA              |
| 3de3f774f98490 | 2007-09-11 | Btrfs Tag v0.8 |                   |
| 6d626f65041e3f | 2007-08-10 | Btrfs Tag v0.7 |                   |
| 37fa704640059d | 2007-08-07 | Btrfs Tag v0.6 |                   |
| f2fdf02406de92 | 2007-06-28 | Btrfs Tag v0.5 |                   |
| 4b2220da64727a | 2007-06-22 | Btrfs Tag v0.4 |                   |
| 63c992fd0b7339 | 2007-06-18 | Btrfs Tag v0.3 |                   |
| b79ab950f57c32 | 2007-06-13 | Btrfs Tag v0.2 |                   |
| 67264484fac91d | 2006-02-07 | Appears normal | V4L/DVB (3325)    |
| 69d37960b578be | 2005-09-30 | Appears normal | IXP2000           |
| 9ba91bd365a7f1 | 2005-06-21 | Appears normal | XFS               |
| eaffe886b5b345 | 2005-06-21 | Appears normal | XFS               |
| 2b7f4bd02699da | 2005-06-21 | Appears normal | XFS               |
| ce1dc02f76432a | 2005-04-17 | File modes     |                   |

I looked into each of the commits to see if there were any discernible
patterns in the 0-file commits.
The first one happens fairly early on in the history of the repository.
It's a commit made by Linus that, according to the commit log message,
fixes some file modes due to the 'git world order'. I'm not sure what
this means, and the current version of git doesn't show any changes as a
result of this commit.
10 of the 39 0-file commits are actually merges that have only a single
parent, which is why they aren't removed by `--no-merges`.
These merges are spread from 2008 to 2013.
7 of the 0-file commits are tags for Btrfs versions. The spanned from
July to September of 2007. These commits are made in fairly quick
succession, usually with only a few days between them.

There are many commits with the message indicating that a change was
made, but for some reason, there is no patch associated with it in the
repository. In one case, commit `7aa86e5155a3c6`, there was a link to a
Patchwork page that did have an associated patch. While the commit in
git reported that it touched no files, Patchwork reported that the
commit touched two files. I don't know where the associated patches for
these commits went, but they appear to be errors.

Quickly looking into the larger commits, they seem to be caused by large
cross-project changes. The largest commit is the initial commit,
importing the entire kernel development into Git in a single commit.

The next largest commit is created by Greg H-K, going through and
systematically going through and adding the GPL 2 license to files that
were missing it, or where the license was incorrectly formatted. This is
part of a multi-month project to ensure that the kernel is licensed
consistently.

The third largest commit make a bunch of changes to the headers, fixing
two headers in particular, the `linux/slab.h` and `linux/gfp.h`. These
are both related to the memory management.

Nothing stood out in particular about these commits.

### LLVM

Lets take a quick look at the 0-file commits in LLVM as well, just to
check that they are consistent with what is happening in Linux.

```sql
SELECT commits.cid, commits.created_at
FROM commits
WHERE commits.files_touched = 0
ORDER BY commits.created_at DESC
LIMIT 10;
```

| cid                                      | created_at                | Notes                                                 |
|------------------------------------------+---------------------------+-------------------------------------------------------|
| a02557d1b8ea2732d1d8f1b9a706b17b90a3819c | 2018-08-03 15:09:56+00:00 | Fix Line ending                                       |
| 0ad50ac3b85deeb12b2836cd638dcee785b88707 | 2018-07-15 23:52:15+00:00 | prune empty directory                                 |
| e7de33fcf27abac4da5f553336bd120c06d640eb | 2018-06-28 17:52:06+00:00 | Change the line-ending to CRLF on a windows-only file |
| 3a09592b608b074810cfec1d4df538653511a416 | 2018-06-27 09:23:38+00:00 | Remove empty codegen dir in root                      |
| a518a5e97ec05be53fa53734c3ae3807006b82fe | 2018-06-05 11:38:11+00:00 | Change EOL property                                   |
| 094f3838fe2d215d9f8a2ff15786527a51b7ae95 | 2017-11-02 08:02:03+00:00 | Remove empty directory                                |
| ae83487a4968d47d8f951c9502f430c938a21f8b | 2017-09-19 00:13:42+00:00 | Set SVN to ignore pyc files                           |
| f1e3a3638c14a995ceb43a58bac068f5b5c78a97 | 2017-04-19 15:43:23+00:00 | Remove eol style from MathExtras.h                    |
| 12e38cb73b45f27d19c4dd82087f6887f328b7b6 | 2017-04-12 19:52:47+00:00 | Remove eol style from Casting.h                       |
| df685624d01263f0a89163656d70fa58b9c73bd5 | 2017-04-10 20:16:54+00:00 | Remove eol style from "some files"                    |

Most of these appear to be caused by differences between git and SVN.
I'm not super familiar with SVN, but I am fairly familiar with git.
The three commits attributed to directory removal are clearly cases
where these commits exist only because of SVN. Git doesn't track
directories, only files, so there is no way for an empty directory to
exist.

Then there are 6 commits attributed to changing line endings in SVN.
Looking at the first one there, is linked with revision
[trunk@338897](https://reviews.llvm.org/rL338897), which lists a file,
but also says that the contents of the file were not changed.
Git tracks the contents and permissions of a file, so if those don't
change, git won't track it. It looks like SVN allows people to set the
end-of-lines that are allowed, so this may be an SVN specific file.
I'm not sure, but what I do know is that Git doesn't know or care about
this change, and that phabricator says the contents haven't changed.

The last commit simply adds pyc files to the SVN ignore file, which
isn't tracked by git.

So, yes, the 0-file commits seem to exist for the purpose of maintaining
the mapping between the commits in the SVN repository and git mirror.

Okay, so now that we kind of understand why there are 0-file commits,
lets quickly pop over to the commits that touch lots of files.

```sql
.load './libs/libsqlitefunctions.so'

SELECT commits.cid,
       commits.files_touched,
       commits.lines_added,
       commits.lines_removed,
       commits.lines_added + commits.lines_removed churn,
       commits.lines_added - commits.lines_removed delta
FROM commits
ORDER BY commits.files_touched DESC
LIMIT 10;
```

| cid             | files_touched | lines_added | lines_removed |  churn | delta |
|-----------------+---------------+-------------+---------------+--------+-------|
| 7c9c6ed761bf9d2 |          3931 |       29317 |         29293 |  58610 |    24 |
| 198d8baafbfdfcf |          2277 |       41849 |         41819 |  83668 |    30 |
| ca0df55065b11f2 |          1435 |       50355 |         50304 | 100659 |    51 |
| b1e1e82c54c060e |          1404 |        1514 |          1514 |   3028 |     0 |
| f2f6ce65b79df6e |          1273 |        1366 |          1366 |   2732 |     0 |
| 69ccadd7535a83b |          1199 |        1682 |          1676 |   3358 |     6 |
| fce288fc9134f0f |          1178 |        1654 |          1654 |   3308 |     0 |
| 1076969bfeb582d |           970 |       29359 |         29350 |  58709 |     9 |
| 36a0947820fd4aa |           968 |        1281 |          1256 |   2537 |    25 |
| cf0db29df20d9c6 |           940 |        1157 |          1157 |   2314 |     0 |

We have some pretty big commits, touching thousands of files. Doing
manual inspection gives some insight into what is going on here.

| cid             | Description                                                                                 | Main Patch | Changed Tests |
|-----------------+---------------------------------------------------------------------------------------------+------------+---------------|
| 7c9c6ed761bf9d2 | Load instruction format change                                                              |          2 |          3929 |
| 198d8baafbfdfcf | GEP instruction format change                                                               |          2 |          2277 |
| ca0df55065b11f2 | MBB format change, and change to debug formatting                                           |         80 |          1353 |
| b1e1e82c54c060e | Passing assembly directly to opt                                                            |          0 |          1404 |
| f2f6ce65b79df6e | Redirect asm files into opt instead of providing fname                                      |          0 |          1273 |
| 69ccadd7535a83b | Run test files through llvm-upgrade before piping to llvm-as                                |          0 |          1199 |
| fce288fc9134f0f | Remove more llvm-as and llvm-dis                                                            |          0 |          1178 |
| 1076969bfeb582d | Move MIR register names to use '$' instead of '%' -- There are four files under 'unittests' |          2 |           964 |
| 36a0947820fd4aa | Dan Gohman removing more llvm-as and llvm-dis                                               |          0 |           968 |
| cf0db29df20d9c6 | Use clang-tidy to fix namespace ending comment: end llvm namespace -> namespace llvm        |        940 |             0 |

This is actually where I got the idea to compare how much of a commit
was the the main source versus test files. For the most part, the files
touched come almost entirely from the test suite.

The last commit there uses clang-tidy to cleanup the namespaces. This
should definitely touch quite a few files.

Now lets just focus on the big commits that are actually touching
non-test files. I'm going to use this little query here. It will ignore
any file with `test` anywhere in the file path.

```sql
.load './libs/libsqlitefunctions.so'
SELECT DISTINCT commits.cid, commits.files_touched
FROM commits
JOIN
(SELECT * FROM files WHERE filename NOT LIKE '%test%')  A
ON commits.cid = A.cid
ORDER BY commits.files_touched DESC
LIMIT 10;
```

| cid                                      | files_touched |
|------------------------------------------+---------------|
| cf0db29df20d9c665da7e82bb261bdd7cf7f1b2b |           938 |
| cd52a7a381a73c53ec4ef517ad87f19808cb1a28 |           937 |
| 26b584c691811dc9c3569391bd24cdd0d2ce3c44 |           774 |
| e3e43d9d574cf0a829e9a58525372ba0868a3292 |           714 |
| d04a8d4b33ff316ca4cf961e06c9e312eff8e64f |           590 |
| 0b8c9a80f20772c3793201ab5b251d3520b9cea3 |           576 |
| d0fde30ce850b78371fd1386338350591f9ff494 |           555 |
| 4ee451de366474b9c228b4e5fa573795a715216d |           548 |
| 0818e789cb58fbf6b5e225a3f1c722294881c445 |           498 |
| 00e08fcaa02286dd7da9cf9a8d158545532ab832 |           475 |

And going through each of these manually gives some insight on what is
going on.

| cid                                      | Notes                                |
|------------------------------------------+--------------------------------------|
| cf0db29df20d9c665da7e82bb261bdd7cf7f1b2b | Clang tidy to fix namespace          |
| cd52a7a381a73c53ec4ef517ad87f19808cb1a28 | Reverts cf0db29df                    |
| 26b584c691811dc9c3569391bd24cdd0d2ce3c44 | Remove \brief from doxygen comment   |
| e3e43d9d574cf0a829e9a58525372ba0868a3292 | Sorting/Fixing includes              |
| d04a8d4b33ff316ca4cf961e06c9e312eff8e64f | Sorting/Fixing includes              |
| 0b8c9a80f20772c3793201ab5b251d3520b9cea3 | Moving IR headers to include/llvm/IR |
| d0fde30ce850b78371fd1386338350591f9ff494 | Put LLVM code into LLVM namespace    |
| 4ee451de366474b9c228b4e5fa573795a715216d | Remove attribution from file header  |
| 0818e789cb58fbf6b5e225a3f1c722294881c445 | Rename DEBUG macro to LLVM_DEBUG     |
| 00e08fcaa02286dd7da9cf9a8d158545532ab832 | Canonicalize header guards           |

Most of these are appear to be non-functional changes (NFCs), changing
comments, the order of the include heads, and renaming stuff in a
project-wide manner. I do like that the second one is reverting the
first.

```
commit cf0db29df20d9c665da7e82bb261bdd7cf7f1b2b
Author: Alexander Kornienko <alexfh@google.com>
Date:   Fri Jun 19 15:57:42 2015 +0000

    Fixed/added namespace ending comments using clang-tidy. NFC

    The patch is generated using this command:

    tools/clang/tools/extra/clang-tidy/tool/run-clang-tidy.py -fix \
      -checks=-*,llvm-namespace-comment -header-filter='llvm/.*|clang/.*' \
      llvm/lib/


    Thanks to Eugene Kosov for the original patch!



    git-svn-id: https://llvm.org/svn/llvm-project/llvm/trunk@240137 91177308-0d34-0410-b5e6-96231b3b80d8
```

```
commit cd52a7a381a73c53ec4ef517ad87f19808cb1a28
Author: Alexander Kornienko <alexfh@google.com>
Date:   Tue Jun 23 09:49:53 2015 +0000

    Revert r240137 (Fixed/added namespace ending comments using clang-tidy. NFC)

    Apparently, the style needs to be agreed upon first.


    git-svn-id: https://llvm.org/svn/llvm-project/llvm/trunk@240390 91177308-0d34-0410-b5e6-96231b3b80d8
```

### Statistics

Plots are pretty, but can be missleading. Time to pull out the stats and
see if there is enough evidence to suggest that the difference in merge
strategy between Linux and LLVM has an effect on the number of files
touched per commit. This is one of those great situations where I
actually have all of the samples from every commit, so I actually get to
do population testing.

I'm going to run two tests on our data, a variant of the 2-sample
t-test, and the Mann Whitney U test. I'm assuming that the samples of
the two sets are independent. I'll have to estimate the variance, but I
think we have enough data to get a reasonable variance. The variances of
the two populations is farily different, with a variance of 669 files in
Linux, and 68 in LLVM. To account for this difference, we'll let R use
the default t-test, which is a modification known as the Welch 2-sample
t-test. This variant adjust the degrees of freedom to account for the
difference in variances between two populations.

- Null Hypothesis: The true difference in means is equal to 0.
- Alternative Hypothesis: The true difference in means is not equal to 0.

I'll also apply the Mann Whitney non-parametric test, which makes no
assumptions about the distribution of the data, but gives the
non-parametric equivalent of the t-test. I am aware that the populations
do not form normal distributions, and while the t-test should have
enough data to give us something that is reasonable, I would also like
to apply a test where we aren't knowingly breaking one of the
assumptions. The main difference with the Mann Whitney test is that it
works with the medians rather than the means of the populations.

- Null Hypothesis: The probability is 50% that a randomly drawn member
  of the first population will exceed a member of the second population.
- Alternative Hypothesis: The two samples come from populations with the
  same median.

The Mann Whitney U test is also sometimes referred to as the Wilcoxon
rank sum test, or even as the Wilcoxon Mann Whitney test.

```R
library(RSQLite)

linux_con <- dbConnect(drv=dbDriver('SQLite'), dbname='./linux.db')
llvm_con <- dbConnect(drv=dbDriver('SQLite'), dbname='./llvm.db')

query <- "
SELECT cid, count(*) files_touched
FROM files
WHERE filename NOT LIKE '%test%'
GROUP BY cid;
"

linux_data <- dbGetQuery(linux_con, query)
llvm_data <- dbGetQuery(llvm_con, query)

dbDisconnect(linux_con)
dbDisconnect(llvm_con)

t.test(linux_data$files_touched, llvm_data$files_touched)
wilcox.test(linux_data$files_touched, llvm_data$files_touched)
```

Welch Two Sample t-test results:

- t: -3.1896
- df: 748,150
- p-value: 0.001425

Mann Whitney U test results (Wilcoxon rank sum test with continuity correction):
- W: 5.4x10^10
- p-value: 0.1701

So the results of the two sample t-test suggests that we reject the Null
Hypothesis, and say that the distribution of files touched per commit is
different between the Linux and LLVM with _p&nbsp;>&nbsp;0.05_. However,
the Mann Whitney U test is technically the better test given that the
data isn't normally distributed. The Mann Whitney U test suggests that
with do not reject the Null Hypothesis with a _p&nbsp;<&nbsp;0.05_. This
makes sense, as we saw in the figure above with the distribution of
files touched after removing the test files, the two distributions
appear to be the same, with the median being 1 file touched, the top of
the third quartile being 2 files, and the top of the fourth quartile
touching 3 files.

It looks like the difference in merge strategy between Linux and LLVM
doesn't have an impact on the number of non-test files touched per
commit.

## Line Churn

I'll try to keep this section a bit shorter than the last. I'll ignore
the tests from the get-go.

```sql
.load './libs/libsqlitefunctions.so'
attach 'llvm.db' as llvm;
attach 'linux.db' as linux;

CREATE TEMPORARY TABLE linux_commits AS SELECT * FROM linux.files WHERE filename NOT LIKE '%test%';
CREATE TEMPORARY TABLE llvm_commits AS SELECT * FROM llvm.files WHERE filename NOT LIKE '%test%';

SELECT project,
       count(*),
       max(churn) max,
       median(churn) median,
       round(avg(churn), 3) avg,
       min(churn) min
FROM
(SELECT 'Linux' project,
        cid,
        sum(added) + sum(removed) churn
 FROM linux_commits GROUP BY cid
 UNION
 SELECT 'LLVM' project,
        cid,
        sum(added) + sum(removed) churn
 FROM llvm_commits GROUP BY cid) A
GROUP BY project;
```

| Project | Commits |     max | median |     avg | min |
|---------+---------+---------+--------+---------+-----|
| LLVM    |  150477 |   64919 |     17 |  96.572 |   0 |
| Linux   |  720383 | 6706071 |     14 | 102.089 |   0 |

Alright, so from an initial view, LLVM has a higher median line churn
per commit, Linux has a higher mean. Both have a minimum of 0 lines
churned, and Linux has a much larger maximum line churn.

Essentially what this tells me is that Linux has some really big
outliers, but probably has an overall churn that is lower than the churn
in LLVM.

Lets just take a quick look at the breakdown of how many commits are
creating varying levels of churn.

```sql
attach './linux.db' as linux;
attach './llvm.db' as llvm;

SELECT  linux_churn.churn Churn,
        linux_churn.commits 'Linux Commits',
        llvm_churn.commits 'LLVM Commits'
FROM
( SELECT churn,
         count(*) commits
    FROM
    ( SELECT cid,
             sum(added) + sum(removed) churn
        FROM (SELECT * FROM linux.files WHERE filename NOT LIKE '%test%')
      GROUP BY cid)
    GROUP BY churn) linux_churn
JOIN
( SELECT churn,
                 count(*) commits
    FROM
    ( SELECT cid,
             sum(added) + sum(removed) churn
        FROM (SELECT * FROM llvm.files WHERE filename NOT LIKE '%test%')
      GROUP BY cid)
  GROUP BY churn) llvm_churn
ON linux_churn.churn = llvm_churn.churn
LIMIT 10;
```

| Churn | Linux Commits | LLVM Commits |
|-------+---------------+--------------|
|     0 |           307 |           67 |
|     1 |         30300 |         4374 |
|     2 |         82886 |        15014 |
|     3 |         29503 |         5708 |
|     4 |         46146 |         9226 |
|     5 |         21219 |         4518 |
|     6 |         30171 |         6127 |
|     7 |         17750 |         3403 |
|     8 |         23801 |         4781 |
|     9 |         15185 |         3055 |

![Churn Behaviour]({{"assets/post_data/CommitBehaviour/churn_commit_counts.svg"
| relative_url}})

Like with the number of files touched, the two distributions are again,
very similar, though there seems to be a much wider spread. The mode is
2 lines churned per commit. From manual inspection in some of my
previous works, is usually related to bug fixes caused by a single
erroneous line. The two lines of churn account for the removal of the
original and the insertion of the fix. There is an interesting stair
step, where there is a higher probability of an even number of lines
churned per commit than an odd number. Linux has a little more skew
toward the lower number of lines churned, but not by very much, and I
certainly don't expect it to influence the results of the statistical
tests. It will be accounted for, but I believe that given this plot,
they will be recognized as coming from the same distributions.

If a factor were to have an influence, I would anticipate any
differences in the tail on the high end to be recognized as difference.
If we simply restrain ourself to the t-test, which compares the mean of
the two distributions and thus is sensitive to outliers, I would imagine
the tails to play a rather important role in determining the outcome.
However, given that this distribution is certainly not normal, we should
trust the non-parametric tests a bit more.

Manually investigating some of the 0-churn changes, I found that they
are caused when a file gets renamed or when permissions are changed.
I believe they also happen when a binary file is added, removed, or
replaced since git can't count lines on them.

### Statistics

It looks like we have slightly conflicting pictures coming from the
means and medians versus the picture shown in the plot. The raw median
is higher with LLVM than with Linux, but the mean is higher with Linux
than LLVM. In both cases, the mean is considerably higher than the
median, suggesting that there are some fairly large outliers on the
upper end.

It seems pretty clear that this data does not fall on a normal
distribution, but lets stay consistent and run both. The variances
between the two populations is quite different and the samples are
independent. Given that the premises are the same, we'll use the same
variant of the t-test as we used in the analysis of the number of files
touched per commit.

- Null Hypothesis: The true difference in the mean number of lines
  churned per commit is equal to 0.
- Alternative Hypothesis: The true difference in the mean number of lines
  churned per commit is not equal to 0.

I'll also apply the Mann Whitney test, which is honestly probably the
better test to use given that the distributions are not normal. Given
that we've already looked at the distribution, the medians, and the
means, we already know that the median line churn per commit in LLVM is
greater than Linux, but the mean Linux churn per commit is less in LLVM
than in Linux. If both tests suggest that we reject the null, I would be
interested to see if they reject in the same direction. I'll still start
out with double-sided tests to start though. The hypotheses for the
Wilcoxon Mann Whitney test are as follows:

- Null Hypothesis: The probability is 50% that a randomly drawn member
  of the first population will exceed a member of the second population.
- Alternative Hypothesis: The two samples come from populations with the
  same median.


```R
library(RSQLite)

linux_con <- dbConnect(drv=dbDriver('SQLite'), dbname='./linux.db')
llvm_con <- dbConnect(drv=dbDriver('SQLite'), dbname='./llvm.db')

query <- "

SELECT cid, sum(added) + sum(removed) churn
FROM files
WHERE filename NOT LIKE '%test%'
GROUP BY cid;
"

linux_data <- dbGetQuery(linux_con, query)
llvm_data <- dbGetQuery(llvm_con, query)

dbDisconnect(linux_con)
dbDisconnect(llvm_con)

t.test(linux_data$churn, llvm_data$churn)
wilcox.test(linux_data$churn, llvm_data$churn)
```

Welch Two Sample t-test results:
- t: 0.57549
- df: 772,010
- p-value: 0.565

Mann Whitney U test results:
- W: 5.1x10^10
- p-value: 2.2x10^-16

So the two sample independent t-test says that we do not reject the Null
Hypothesis given the current evidence, with _p&nbsp;>&nbsp;0.05_.
Meanwhile, the Wilcoxon Mann Whitney test suggests that we reject the
null hypothesis, that there is a difference between the number of lines
churned per commit between the Linux and LLVM repositories. The numbers
coming from the Mann Whitney test look a little extreme though,
especially given that the distributions _appear_ to be so similar. I did
notice that Linux has a higher percentage of the commits churning 1 or 2
lines than LLVM, and LLVM doesn't appear to make up the percentage
anywhere in the view of the plot. This means that it will have a longer
tail, bringing up the median and mean, but I'm a little skeptical of
this difference being that polarizing.

I kind of wish that the distributions were normal, or at least closer,
so that we could do some further investigation here. I find it pretty
fascinating how one could draw two totally different conclusions about
the data using one or the other. One might argue that neither metric is
technically more correct than the other, but the mean is usually
misleading when the distributions are not normal. At least in my
experience.

# Conclusion

Alright, this has been a rather long walk through the corn field. There
wasn't a significant difference in the number of non-test files touched
per commit in the two projects. Most of the commits only touch a single
source file per commit, with the third quartile including up to 2 files,
and the fourth quartile extending up to 3 files.

There was a statistically significant difference in the number of
non-test lines churned per commit. I'm a little skeptical of the p-value
that was produced, but the other metrics appear to be in support of
this. The median number of non-test lines churned per commit in Linux is
14, while the median non-test lines churned per commit in LLVM is 17.

The difference in the merge strategy did not have an effect on the
number of files touched per commit, but does have an effect on the
number of lines churned per commit.

On a side-quest in the background section, I learned a bit more about
how much the two projects test. LLVM seems to test a lot, with roughly
half of all of the files touched per commit contributing to the test
suite, and nearly 60% of the lines changed per commit being changes to
the test suite.

I wasn't able to upload the databases to GitHub as they are too large,
but the scripts I used to generate them, and the scripts for generating
the plots are [available](https://github.com/etcwilde/Research/tree/CommitProfiles).
